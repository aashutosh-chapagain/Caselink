import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Alert from '../models/Alert';
import { requireAuth, requireAdmin, AuthedRequest } from '../middleware/auth';

const router = Router();

// GET /api/v1/alerts/public?workspaceId=<id>
// No auth — intentionally public. workspaceId comes from query param here
// because there is no JWT to derive it from.
router.get('/public', async (req: Request, res: Response) => {
    const { workspaceId } = req.query as Record<string, string>;

    if (!workspaceId || !mongoose.Types.ObjectId.isValid(workspaceId)) {
        return res.status(400).json({ error: 'Valid workspaceId is required' });
    }

    const alerts = await Alert.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        isActive: true,
    })
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });

    res.json(alerts);
});

// All routes below require authentication
router.use(requireAuth);

// GET /api/v1/alerts — list all alerts for the workspace (active + inactive)
router.get('/', async (req: AuthedRequest, res) => {
    const alerts = await Alert.find({ workspaceId: req.workspaceId })
        .populate('createdBy', 'name')
        .sort({ isActive: -1, createdAt: -1 });

    res.json(alerts);
});

// POST /api/v1/alerts — create an alert (admin only)
router.post('/', requireAdmin, async (req: AuthedRequest, res) => {
    const { message, severity, region, lat, lng } = req.body;

    if (!message?.trim()) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const validSeverities = ['critical', 'high', 'medium', 'info'];
    if (severity && !validSeverities.includes(severity)) {
        return res.status(400).json({ error: 'Invalid severity' });
    }

    const alert = await Alert.create({
        message: message.trim(),
        severity: severity || 'info',
        region: region?.trim() || undefined,
        ...(lat !== undefined && lng !== undefined && { lat, lng }),
        createdBy: req.userId,
        workspaceId: req.workspaceId,
    });

    const populated = await alert.populate('createdBy', 'name');
    req.app.get('io').to(`workspace:${req.workspaceId}`).emit('alert:created', populated);
    res.status(201).json(populated);
});

// PATCH /api/v1/alerts/:id — toggle isActive (admin only)
router.patch('/:id', requireAdmin, async (req: AuthedRequest, res) => {
    const alert = await Alert.findOne({
        _id: req.params.id,
        workspaceId: req.workspaceId,
    });

    if (!alert) {
        return res.status(404).json({ error: 'Alert not found' });
    }

    alert.isActive = !alert.isActive;
    await alert.save();

    const populated = await alert.populate('createdBy', 'name');
    req.app.get('io').to(`workspace:${req.workspaceId}`).emit('alert:updated', populated);
    res.json(populated);
});

export default router;
