import { Router } from 'express';
import CaseModel from '../models/Case';
import Activity from '../models/Activity';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// GET /api/v1/cases - list cases (scoped by workspace + role)
router.get('/', async (req: AuthedRequest, res) => {
    const filter: Record<string, unknown> = { workspaceId: req.workspaceId };

    // Caseworkers only see cases assigned to them; admins see everything in the workspace
    if (req.role === 'caseworker') {
        filter.assignedTo = req.userId;
    }

    if (req.query.status) {
        filter.status = req.query.status;
    }

    const cases = await CaseModel.find(filter)
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

    res.json(cases);
});

// POST /api/v1/cases - create a case
router.post('/', async (req: AuthedRequest, res) => {
    const { title, description, region } = req.body;

    if (!title || !description || !region) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const newCase = await CaseModel.create({
        title,
        description,
        region,
        status: 'open',
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

// PATCH /api/v1/cases/:id - update status and/or assignee
router.patch('/:id', async (req: AuthedRequest, res) => {
    const { status, assignedTo } = req.body;

    if (assignedTo !== undefined && req.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can reassign cases' });
    }

    const validStatuses = ['open', 'in_progress', 'closed'];
    if (status !== undefined && !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const existing = await CaseModel.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!existing) {
        return res.status(404).json({ error: 'Case not found' });
    }

    const activityLogs: Promise<any>[] = [];

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

    if (activityLogs.length === 0) {
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