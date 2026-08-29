import { Router } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';
import Workspace from '../models/Workspace';
import { signToken } from '../utils/jwt';

const router = Router();

router.post('/register', async (req, res) => {
    const { name, email, password, workspaceName, role } = req.body;

    if (!name || !email || !password || !workspaceName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
    }

    let workspace = await Workspace.findOne({ name: workspaceName });
    if (!workspace) {
        workspace = await Workspace.create({ name: workspaceName });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
        name,
        email,
        passwordHash,
        role: role === 'admin' ? 'admin' : 'caseworker',
        workspaceId: workspace._id,
    });

    const token = signToken({
        userId: user._id.toString(),
        workspaceId: workspace._id.toString(),
        role: user.role,
    });

    res.status(201).json({
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role, workspaceId: workspace._id },
    });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({
        userId: user._id.toString(),
        workspaceId: user.workspaceId.toString(),
        role: user.role,
    });

    res.json({
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role, workspaceId: user.workspaceId },
    });
});

export default router;