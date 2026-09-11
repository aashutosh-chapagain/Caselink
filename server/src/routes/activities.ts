import { Router } from 'express';
import Activity from '../models/Activity';
import CaseModel from '../models/Case';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// GET /api/v1/cases/:caseId/activities - list activity for a case (paginated)
router.get('/:caseId/activities', async (req: AuthedRequest, res) => {
    const caseExists = await CaseModel.findOne({
        _id: req.params.caseId,
        workspaceId: req.workspaceId,
    });
    if (!caseExists) {
        return res.status(404).json({ error: 'Case not found' });
    }

    const { limit, before } = req.query as Record<string, string>;
    const pageLimit = parseInt(limit) || 20;

    const filter: Record<string, unknown> = {
        caseId: req.params.caseId,
        workspaceId: req.workspaceId,
    };

    if (before) {
        filter._id = { $lt: before };
    }

    const activities = await Activity.find(filter)
        .populate('authorId', 'name email')
        .sort({ createdAt: -1 })
        .limit(pageLimit + 1);

    let hasMore = false;
    if (activities.length > pageLimit) {
        hasMore = true;
        activities.pop();
    }

    activities.reverse();

    res.json({ activities, hasMore });
});

// POST /api/v1/cases/:caseId/activities - add a note
router.post('/:caseId/activities', async (req: AuthedRequest, res) => {
    const { note } = req.body;
    if (!note || !note.trim()) {
        return res.status(400).json({ error: 'Note cannot be empty' });
    }

    const caseExists = await CaseModel.findOne({
        _id: req.params.caseId,
        workspaceId: req.workspaceId,
    });
    if (!caseExists) {
        return res.status(404).json({ error: 'Case not found' });
    }

    const activity = await Activity.create({
        caseId: req.params.caseId as string,
        authorId: req.userId,
        note,
        type: 'note',
        workspaceId: req.workspaceId,
    });

    const populated = await activity.populate('authorId', 'name email');
    req.app.get('io').to(`workspace:${req.workspaceId}`).emit('activity:added', populated);
    res.status(201).json(populated);
});

export default router;