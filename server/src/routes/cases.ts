import { Router } from 'express';
import mongoose from 'mongoose';
import CaseModel from '../models/Case';
import Activity from '../models/Activity';
import Notification from '../models/Notification';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// GET /api/v1/cases - list cases (scoped by workspace + role)
router.get('/', async (req: AuthedRequest, res) => {
    const { status, cursor, limit, search } = req.query as Record<string, string>;

    // Aggregation requires explicit ObjectId casting — unlike find(), $match does not auto-cast strings.
    const filter: Record<string, unknown> = {
        workspaceId: new mongoose.Types.ObjectId(req.workspaceId),
    };

    if (req.role === 'caseworker') {
        filter.assignedTo = new mongoose.Types.ObjectId(req.userId);
    }

    if (status) {
        const statuses = status.split(',');
        filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }

    if (search && search.trim()) {
        // Escape special regex chars to prevent injection / unexpected behaviour
        const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
            { title:       { $regex: escaped, $options: 'i' } },
            { description: { $regex: escaped, $options: 'i' } },
            { region:      { $regex: escaped, $options: 'i' } },
            { address:     { $regex: escaped, $options: 'i' } },
        ];
    }

    const isClosedPage = status === 'closed';
    const pageLimit = isClosedPage ? (parseInt(limit) || 20) : 0;

    if (isClosedPage && cursor) {
        filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const pipeline: mongoose.PipelineStage[] = [
        { $match: filter },
        {
            $addFields: {
                priorityOrder: {
                    $switch: {
                        branches: [
                            { case: { $eq: ['$priority', 'critical'] }, then: 0 },
                            { case: { $eq: ['$priority', 'high'] }, then: 1 },
                            { case: { $eq: ['$priority', 'medium'] }, then: 2 },
                            { case: { $eq: ['$priority', 'low'] }, then: 3 },
                        ],
                        default: 4,
                    },
                },
            },
        },
        { $sort: { priorityOrder: 1, updatedAt: -1 } },
    ];

    if (pageLimit) pipeline.push({ $limit: pageLimit + 1 });

    const cases = await CaseModel.aggregate(pipeline);

    let hasMore = false;
    if (pageLimit && cases.length > pageLimit) {
        hasMore = true;
        cases.pop();
    }

    // aggregate() returns plain objects — populate them after
    await CaseModel.populate(cases, [
        { path: 'assignedTo', select: 'name email' },
        { path: 'createdBy', select: 'name email' },
    ]);

    res.json({ cases, hasMore });
});

// POST /api/v1/cases - create a case
router.post('/', async (req: AuthedRequest, res) => {
    const { title, description, region, priority, type, address, lat, lng, dueAt } = req.body;

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

    if (dueAt !== undefined && dueAt !== null && isNaN(new Date(dueAt).getTime())) {
        return res.status(400).json({ error: 'Invalid due date' });
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
        ...(dueAt && { dueAt: new Date(dueAt) }),
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

// GET /api/v1/cases/export - download all matching cases as CSV
router.get('/export', async (req: AuthedRequest, res) => {
    const { status, search, overdue } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {
        workspaceId: new mongoose.Types.ObjectId(req.workspaceId),
    };

    if (req.role === 'caseworker') {
        filter.assignedTo = new mongoose.Types.ObjectId(req.userId);
    }

    if (overdue === 'true') {
        filter.status = { $in: ['open', 'in_progress'] };
        filter.dueAt = { $lt: new Date(), $ne: null };
    } else if (status) {
        const statuses = status.split(',');
        filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }

    if (search && search.trim()) {
        const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
            { title:       { $regex: escaped, $options: 'i' } },
            { description: { $regex: escaped, $options: 'i' } },
            { region:      { $regex: escaped, $options: 'i' } },
            { address:     { $regex: escaped, $options: 'i' } },
        ];
    }

    const cases = await CaseModel.find(filter)
        .populate('assignedTo', 'name')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .lean();

    function escapeCsv(val: unknown): string {
        if (val == null) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
    }

    function fmtDate(d: unknown): string {
        if (!d) return '';
        return new Date(d as string).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    const headers = ['ID', 'Title', 'Type', 'Priority', 'Status', 'Region', 'Assigned To', 'Created By', 'Due Date', 'Address', 'Created'];
    const rows = (cases as any[]).map(c =>
        [c._id, c.title, c.type, c.priority, c.status, c.region, c.assignedTo?.name, c.createdBy?.name, c.dueAt ? fmtDate(c.dueAt) : '', c.address, fmtDate(c.createdAt)]
            .map(escapeCsv).join(',')
    );

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="cases-${date}.csv"`);
    res.send([headers.join(','), ...rows].join('\n'));
});

// GET /api/v1/cases/:id - get one case (workspace-scoped)
router.get('/:id', async (req: AuthedRequest, res) => {
    const found = await CaseModel.findOne({
        _id: req.params.id,
        workspaceId: req.workspaceId,
    })
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .populate('linkedCaseIds', 'title status priority type region');

    if (!found) {
        return res.status(404).json({ error: 'Case not found' });
    }

    res.json(found);
});

// POST /api/v1/cases/:id/links - link two cases (bidirectional)
router.post('/:id/links', async (req: AuthedRequest, res) => {
    const { caseId } = req.body;

    if (!caseId) {
        return res.status(400).json({ error: 'caseId is required' });
    }
    if (caseId === req.params.id) {
        return res.status(400).json({ error: 'Cannot link a case to itself' });
    }

    const [caseA, caseB] = await Promise.all([
        CaseModel.findOne({ _id: req.params.id, workspaceId: req.workspaceId }),
        CaseModel.findOne({ _id: caseId, workspaceId: req.workspaceId }),
    ]);

    if (!caseA || !caseB) {
        return res.status(404).json({ error: 'One or both cases not found' });
    }

    const alreadyLinked = (caseA.linkedCaseIds as mongoose.Types.ObjectId[])
        .some(id => id.toString() === caseId);
    if (alreadyLinked) {
        return res.status(400).json({ error: 'Cases are already linked' });
    }

    await Promise.all([
        CaseModel.updateOne({ _id: caseA._id }, { $push: { linkedCaseIds: caseB._id } }),
        CaseModel.updateOne({ _id: caseB._id }, { $push: { linkedCaseIds: caseA._id } }),
        Activity.create({
            caseId: caseA._id, authorId: req.userId,
            note: `Linked to case: "${caseB.title}"`, type: 'update', workspaceId: req.workspaceId,
        }),
        Activity.create({
            caseId: caseB._id, authorId: req.userId,
            note: `Linked to case: "${caseA.title}"`, type: 'update', workspaceId: req.workspaceId,
        }),
    ]);

    const [populatedA, populatedB] = await Promise.all([
        CaseModel.findById(caseA._id)
            .populate('assignedTo', 'name email').populate('createdBy', 'name email')
            .populate('linkedCaseIds', 'title status priority type region'),
        CaseModel.findById(caseB._id)
            .populate('assignedTo', 'name email').populate('createdBy', 'name email')
            .populate('linkedCaseIds', 'title status priority type region'),
    ]);

    const io = req.app.get('io');
    io.to(`workspace:${req.workspaceId}`).emit('case:updated', populatedA);
    io.to(`workspace:${req.workspaceId}`).emit('case:updated', populatedB);

    res.json(populatedA);
});

// DELETE /api/v1/cases/:id/links/:linkedId - remove a link (bidirectional)
router.delete('/:id/links/:linkedId', async (req: AuthedRequest, res) => {
    const { id, linkedId } = req.params;

    const [caseA, caseB] = await Promise.all([
        CaseModel.findOne({ _id: id, workspaceId: req.workspaceId }),
        CaseModel.findOne({ _id: linkedId, workspaceId: req.workspaceId }),
    ]);

    if (!caseA || !caseB) {
        return res.status(404).json({ error: 'One or both cases not found' });
    }

    await Promise.all([
        CaseModel.updateOne({ _id: caseA._id }, { $pull: { linkedCaseIds: caseB._id } }),
        CaseModel.updateOne({ _id: caseB._id }, { $pull: { linkedCaseIds: caseA._id } }),
        Activity.create({
            caseId: caseA._id, authorId: req.userId,
            note: `Removed link to case: "${caseB.title}"`, type: 'update', workspaceId: req.workspaceId,
        }),
        Activity.create({
            caseId: caseB._id, authorId: req.userId,
            note: `Removed link to case: "${caseA.title}"`, type: 'update', workspaceId: req.workspaceId,
        }),
    ]);

    const [populatedA, populatedB] = await Promise.all([
        CaseModel.findById(caseA._id)
            .populate('assignedTo', 'name email').populate('createdBy', 'name email')
            .populate('linkedCaseIds', 'title status priority type region'),
        CaseModel.findById(caseB._id)
            .populate('assignedTo', 'name email').populate('createdBy', 'name email')
            .populate('linkedCaseIds', 'title status priority type region'),
    ]);

    const io = req.app.get('io');
    io.to(`workspace:${req.workspaceId}`).emit('case:updated', populatedA);
    io.to(`workspace:${req.workspaceId}`).emit('case:updated', populatedB);

    res.json(populatedA);
});

// PATCH /api/v1/cases/bulk - bulk update status on multiple cases
router.patch('/bulk', async (req: AuthedRequest, res) => {
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    if (ids.length > 100) {
        return res.status(400).json({ error: 'Cannot bulk update more than 100 cases at once' });
    }

    const validStatuses = ['open', 'in_progress', 'closed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const caseworkerFilter = req.role === 'caseworker'
        ? { assignedTo: new mongoose.Types.ObjectId(req.userId) }
        : {};

    // Only fetch cases that actually need a status change
    const cases = await CaseModel.find({
        _id: { $in: ids },
        workspaceId: new mongoose.Types.ObjectId(req.workspaceId),
        ...caseworkerFilter,
        status: { $ne: status },
    });

    await Promise.all(cases.map(async (existing) => {
        const oldStatus = existing.status;
        existing.status = status;
        await existing.save();

        await Activity.create({
            caseId: existing._id,
            authorId: req.userId,
            note: `Status changed from ${oldStatus} to ${status}`,
            type: 'status_change',
            workspaceId: req.workspaceId,
        });

        const populated = await existing.populate([
            { path: 'assignedTo', select: 'name email' },
            { path: 'createdBy', select: 'name email' },
        ]);
        req.app.get('io').to(`workspace:${req.workspaceId}`).emit('case:updated', populated);
    }));

    res.json({ updated: cases.length });
});

// PATCH /api/v1/cases/:id - update status, assignee, title, description, priority, type, address, dueAt
router.patch('/:id', async (req: AuthedRequest, res) => {
    const { status, assignedTo, title, description, priority, type, address, lat, lng, dueAt } = req.body;

    if (assignedTo !== undefined && req.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can reassign cases' });
    }

    const validStatuses = ['open', 'in_progress', 'closed'];
    if (status !== undefined && !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const validPriorities = ['critical', 'high', 'medium', 'low'];
    if (priority !== undefined && !validPriorities.includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority' });
    }

    const validTypes = ['fire', 'medical', 'welfare_check', 'missing_person', 'hazmat', 'rescue', 'other'];
    if (type !== undefined && !validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid case type' });
    }

    if (title !== undefined && !title.trim()) {
        return res.status(400).json({ error: 'Title cannot be empty' });
    }

    if (dueAt !== undefined && dueAt !== null && isNaN(new Date(dueAt).getTime())) {
        return res.status(400).json({ error: 'Invalid due date' });
    }

    const existing = await CaseModel.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!existing) {
        return res.status(404).json({ error: 'Case not found' });
    }

    const activityLogs: Promise<any>[] = [];

    if (priority !== undefined && priority !== existing.priority) {
        activityLogs.push(
            Activity.create({
                caseId: existing._id,
                authorId: req.userId,
                note: `Priority changed from ${existing.priority} to ${priority}`,
                type: 'update',
                workspaceId: req.workspaceId,
            })
        );
        existing.priority = priority;
    }

    if (type !== undefined && type !== existing.type) {
        activityLogs.push(
            Activity.create({
                caseId: existing._id,
                authorId: req.userId,
                note: `Type changed from ${existing.type.replace(/_/g, ' ')} to ${type.replace(/_/g, ' ')}`,
                type: 'update',
                workspaceId: req.workspaceId,
            })
        );
        existing.type = type;
    }

    if (title !== undefined && title.trim() !== existing.title) {
        activityLogs.push(
            Activity.create({
                caseId: existing._id,
                authorId: req.userId,
                note: `Title changed from "${existing.title}" to "${title.trim()}"`,
                type: 'update',
                workspaceId: req.workspaceId,
            })
        );
        existing.title = title.trim();
    }

    if (description !== undefined && description.trim() !== existing.description) {
        existing.description = description.trim();
    }

    if (address !== undefined) {
        const oldAddress = existing.address;
        const newAddress = address || undefined;
        if (newAddress !== oldAddress) {
            activityLogs.push(
                Activity.create({
                    caseId: existing._id,
                    authorId: req.userId,
                    note: newAddress ? `Address updated to "${newAddress}"` : 'Address removed',
                    type: 'update',
                    workspaceId: req.workspaceId,
                })
            );
        }
        existing.address = newAddress;
        existing.lat = address ? lat : undefined;
        existing.lng = address ? lng : undefined;
    }

    if (dueAt !== undefined) {
        const newDueAt = dueAt ? new Date(dueAt) : null;
        const oldTime = existing.dueAt ? (existing.dueAt as unknown as Date).getTime() : null;
        const newTime = newDueAt ? newDueAt.getTime() : null;
        if (oldTime !== newTime) {
            activityLogs.push(
                Activity.create({
                    caseId: existing._id,
                    authorId: req.userId,
                    note: newDueAt
                        ? `Due date set to ${newDueAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : 'Due date removed',
                    type: 'update',
                    workspaceId: req.workspaceId,
                })
            );
            (existing as any).dueAt = newDueAt;
            (existing as any).overdueNotifiedAt = null; // reset so re-notification fires if new date also passes
        }
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

    let notifyAssignee = false;
    if (assignedTo !== undefined && assignedTo !== existing.assignedTo?.toString()) {
        existing.assignedTo = assignedTo;
        notifyAssignee = assignedTo !== req.userId; // don't notify self-assignment

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

    if (notifyAssignee) {
        const notification = await Notification.create({
            userId: assignedTo,
            workspaceId: req.workspaceId,
            type: 'assignment',
            message: `You were assigned: "${existing.title}"`,
            caseId: existing._id,
        });
        req.app.get('io').to(`user:${assignedTo}`).emit('notification:new', notification);
    }

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