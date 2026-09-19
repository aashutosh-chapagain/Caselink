import { Router } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';
import Workspace from '../models/Workspace';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// GET /api/v1/users - list all users in the caller's workspace
router.get('/', async (req: AuthedRequest, res) => {
    const users = await User.find({ workspaceId: req.workspaceId })
        .select('name email role')
        .sort({ name: 1 });

    res.json(users);
});

// GET /api/v1/users/me - return current user + workspace name
router.get('/me', async (req: AuthedRequest, res) => {
    const [user, workspace] = await Promise.all([
        User.findById(req.userId).select('name email role'),
        Workspace.findById(req.workspaceId).select('name'),
    ]);

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ ...user.toObject(), workspaceName: workspace?.name ?? '' });
});

// PATCH /api/v1/users/me - update own profile (name)
router.patch('/me', async (req: AuthedRequest, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }

    const user = await User.findByIdAndUpdate(
        req.userId,
        { name: name.trim() },
        { new: true, select: 'name email role' },
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
});

// PATCH /api/v1/users/me/password - change own password
router.patch('/me/password', async (req: AuthedRequest, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Both current and new password are required' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password updated' });
});

export default router;
