import { Router } from 'express';
import Activity from '../models/Activity';
import CaseModel from '../models/Case';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// GET /api/v1/cases/:caseId/activities - list activity for a case
router.get('/:caseId/activities', async (req: AuthedRequest, res) => {
    const caseExists = await CaseModel.findOne({
        _id: req.params.caseId,
        workspaceId: req.workspaceId,
    });
    if (!caseExists) {
        return res.status(404).json({ error: 'Case not found' });
    }

    const activities = await Activity.find({
        caseId: req.params.caseId,
        workspaceId: req.workspaceId,
    })
        .populate('authorId', 'name email')
        .sort({ createdAt: 1 });

    res.json(activities);
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
        caseId: req.params.caseId,
        authorId: req.userId,
        note,
        type: 'note',
        workspaceId: req.workspaceId,
    });

    const populated = await activity.populate('authorId', 'name email');

    res.status(201).json(populated);
});

export default router;