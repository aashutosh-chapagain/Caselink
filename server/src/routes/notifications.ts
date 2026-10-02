import { Router } from 'express';
import Notification from '../models/Notification';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/v1/notifications — last 20 notifications for current user
router.get('/', async (req: AuthedRequest, res) => {
    const notifications = await Notification.find({ userId: req.userId })
        .sort({ createdAt: -1 })
        .limit(20);
    res.json(notifications);
});

// PATCH /api/v1/notifications/read — mark all unread as read
router.patch('/read', async (req: AuthedRequest, res) => {
    await Notification.updateMany({ userId: req.userId, read: false }, { read: true });
    res.json({ message: 'Notifications marked as read' });
});

export default router;
