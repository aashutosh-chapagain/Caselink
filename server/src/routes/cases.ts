import { Router } from 'express';
import CaseModel from '../models/Case';
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

    res.status(201).json(newCase);
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

export default router;