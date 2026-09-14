import { Router } from 'express';
import mongoose from 'mongoose';
import CaseModel from '../models/Case';
import Activity from '../models/Activity';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// GET /api/v1/dashboard/stats
router.get('/stats', async (req: AuthedRequest, res) => {
    const workspaceId = new mongoose.Types.ObjectId(req.workspaceId);
    const baseMatch: Record<string, unknown> = { workspaceId };

    if (req.role === 'caseworker') {
        baseMatch.assignedTo = new mongoose.Types.ObjectId(req.userId);
    }

    const activeMatch = { ...baseMatch, status: { $in: ['open', 'in_progress'] } };

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [statusCounts, priorityCounts, typeCounts, assigneeCounts, closedThisMonth, unassigned, recentActivityCaseIds, trendRaw] =
        await Promise.all([
            // Count by status (all non-closed)
            CaseModel.aggregate([
                { $match: activeMatch },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),

            // Count active cases by priority
            CaseModel.aggregate([
                { $match: activeMatch },
                { $group: { _id: '$priority', count: { $sum: 1 } } },
            ]),

            // Count active cases by type
            CaseModel.aggregate([
                { $match: activeMatch },
                { $group: { _id: '$type', count: { $sum: 1 } } },
            ]),

            // Count active cases per assignee (admin only)
            req.role === 'admin'
                ? CaseModel.aggregate([
                      { $match: activeMatch },
                      { $group: { _id: '$assignedTo', open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } }, inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } } } },
                      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
                      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                      { $project: { _id: 1, name: '$user.name', open: 1, inProgress: 1 } },
                      { $sort: { open: -1, inProgress: -1 } },
                  ])
                : Promise.resolve([]),

            // Count cases closed this calendar month
            CaseModel.countDocuments({
                ...baseMatch,
                status: 'closed',
                updatedAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            }),

            // Count active cases with no assignee (admin only)
            req.role === 'admin'
                ? CaseModel.countDocuments({
                      workspaceId,
                      status: { $in: ['open', 'in_progress'] },
                      $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }],
                  })
                : Promise.resolve(0),

            // IDs of cases that had activity in the last 7 days (for stale detection)
            Activity.distinct('caseId', { workspaceId, createdAt: { $gte: sevenDaysAgo } }),

            // Cases created per day over last 7 days (for trend chart)
            CaseModel.aggregate([
                { $match: { ...baseMatch, createdAt: { $gte: sevenDaysAgo } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]),
        ]);

    // Stale cases: active, created 7+ days ago, no activity in last 7 days
    const staleCases = await CaseModel.find({
        workspaceId,
        ...(req.role === 'caseworker' ? { assignedTo: new mongoose.Types.ObjectId(req.userId) } : {}),
        status: { $in: ['open', 'in_progress'] as const },
        _id: { $nin: recentActivityCaseIds },
        createdAt: { $lt: sevenDaysAgo },
    })
        .populate('assignedTo', 'name')
        .select('title priority status assignedTo createdAt')
        .sort({ createdAt: 1 })
        .limit(5);

    // Fill trend: ensure all 7 days are present, missing days = 0
    const trendMap = Object.fromEntries(trendRaw.map((r: any) => [r._id, r.count]));
    const trend = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const key = d.toISOString().split('T')[0];
        return { date: key, count: trendMap[key] ?? 0 };
    });

    // Reshape array results into plain objects for easy consumption on the client
    const byStatus = Object.fromEntries(statusCounts.map((r: any) => [r._id, r.count]));
    const byPriority = Object.fromEntries(priorityCounts.map((r: any) => [r._id, r.count]));
    const byType = Object.fromEntries(typeCounts.map((r: any) => [r._id, r.count]));

    res.json({
        open: byStatus['open'] ?? 0,
        inProgress: byStatus['in_progress'] ?? 0,
        criticalOpen: byPriority['critical'] ?? 0,
        closedThisMonth,
        unassigned,
        byPriority: {
            critical: byPriority['critical'] ?? 0,
            high: byPriority['high'] ?? 0,
            medium: byPriority['medium'] ?? 0,
            low: byPriority['low'] ?? 0,
        },
        byType,
        workload: assigneeCounts,
        staleCases,
        trend,
    });
});

// GET /api/v1/dashboard/activity
router.get('/activity', async (req: AuthedRequest, res) => {
    const workspaceId = new mongoose.Types.ObjectId(req.workspaceId);
    const filter: Record<string, unknown> = { workspaceId };

    // Caseworkers only see activity on cases assigned to them
    if (req.role === 'caseworker') {
        const assignedCases = await CaseModel.find(
            { workspaceId, assignedTo: new mongoose.Types.ObjectId(req.userId) },
            '_id'
        );
        filter.caseId = { $in: assignedCases.map(c => c._id) };
    }

    const activities = await Activity.find(filter)
        .populate('authorId', 'name email')
        .populate('caseId', 'title')
        .sort({ createdAt: -1 })
        .limit(10);

    res.json(activities);
});

export default router;
