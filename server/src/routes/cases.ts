import { Router } from 'express';
import CaseModel from '../models/Case';
import Activity from '../models/Activity';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// GET /api/v1/cases - list cases (scoped by workspace + role)
router.get('/', async (req: AuthedRequest, res) => {
    const filter: Record<string, unknown> = { workspaceId: req.workspaceId };

    if (req.role === 'caseworker') {
        filter.assignedTo = req.userId;
    }

    const { status, cursor, limit } = req.query as Record<string, string>;

    if (status) {
        const statuses = status.split(',');
        filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }

    const isClosedPage = status === 'closed';
    const pageLimit = isClosedPage ? (parseInt(limit) || 20) : 0;

    if (isClosedPage && cursor) {
        filter._id = { $lt: cursor };
    }

    const query = CaseModel.find(filter)
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

    if (pageLimit) query.limit(pageLimit + 1);

    const cases = await query;

    let hasMore = false;
    if (pageLimit && cases.length > pageLimit) {
        hasMore = true;
        cases.pop();
    }

    res.json({ cases, hasMore });
});

// POST /api/v1/cases - create a case
router.post('/', async (req: AuthedRequest, res) => {
    const { title, description, region, priority, type, address, lat, lng } = req.body;

    if (!title || !description || !region || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const validTypes = ['fire', 'medical', 'welfare_check', 'missing_person', 'hazmat', 'rescue', 'other'];
    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid case type' });
    }

    const validPriorities = ['critical', 'high', 'medium', 'low'];
    if (priority !== undefined && !validPriorities.includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority' });
    }

    const newCase = await CaseModel.create({
        title,
        description,
        region,
        type,
        priority: priority || 'medium',
        status: 'open',
        ...(address && { address }),
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng }),
        createdBy: req.userId,
        assignedTo: req.userId,
        workspaceId: req.workspaceId,
    });

    const populated = await newCase.populate([
        { path: 'assignedTo', select: 'name email' },
        { path: 'createdBy', select: 'name email' },
    ]);

    req.app.get('io').to(`workspace:${req.workspaceId}`).emit('case:created', populated);
    res.status(201).json(populated);
});

// GET /api/v1/cases/:id - get one case (workspace-scoped)
router.get('/:id', async (req: AuthedRequest, res) => {
    const found = await CaseModel.findOne({
        _id: req.params.id,
        workspaceId: req.workspaceId,
    })
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email');

    if (!found) {
        return res.status(404).json({ error: 'Case not found' });
    }

    res.json(found);
});

// PATCH /api/v1/cases/:id - update status, assignee, title, or description
router.patch('/:id', async (req: AuthedRequest, res) => {
    const { status, assignedTo, title, description } = req.body;

    if (assignedTo !== undefined && req.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can reassign cases' });
    }

    const validStatuses = ['open', 'in_progress', 'closed'];
    if (status !== undefined && !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    if (title !== undefined && !title.trim()) {
        return res.status(400).json({ error: 'Title cannot be empty' });
    }

    const existing = await CaseModel.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!existing) {
        return res.status(404).json({ error: 'Case not found' });
    }

    const activityLogs: Promise<any>[] = [];

    if (title !== undefined && title.trim() !== existing.title) {
        existing.title = title.trim();
    }

    if (description !== undefined && description.trim() !== existing.description) {
        existing.description = description.trim();
    }

    if (status !== undefined && status !== existing.status) {
        const oldStatus = existing.status;
        existing.status = status;

        activityLogs.push(
            Activity.create({
                caseId: existing._id,
                authorId: req.userId,
                note: `Status changed from ${oldStatus} to ${status}`,
                type: 'status_change',
                workspaceId: req.workspaceId,
            })
        );
    }

    if (assignedTo !== undefined && assignedTo !== existing.assignedTo?.toString()) {
        existing.assignedTo = assignedTo;

        activityLogs.push(
            Activity.create({
                caseId: existing._id,
                authorId: req.userId,
                note: `Case reassigned`,
                type: 'assignment',
                workspaceId: req.workspaceId,
            })
        );
    }

    const hasChanges = existing.isModified();

    if (!hasChanges && activityLogs.length === 0) {
        return res.json(existing);
    }

    await existing.save();

    const createdActivities = await Promise.all(activityLogs);
    await Promise.all(
        createdActivities.map(async (a) => {
            const populated = await a.populate('authorId', 'name email');
            req.app.get('io').to(`workspace:${req.workspaceId}`).emit('activity:added', populated);
        })
    );

    const populatedCase = await existing.populate([
        { path: 'assignedTo', select: 'name email' },
        { path: 'createdBy', select: 'name email' },
    ]);

    req.app.get('io').to(`workspace:${req.workspaceId}`).emit('case:updated', populatedCase);

    res.json(populatedCase);
});

export default router;