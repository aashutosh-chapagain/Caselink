import { Router } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';
import Workspace from '../models/Workspace';
import Invite from '../models/Invite';
import { signToken } from '../utils/jwt';

const router = Router();

router.post('/register', async (req, res) => {
    const { name, email, password, workspaceName } = req.body;

    if (!name || !email || !password || !workspaceName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingWorkspace = await Workspace.findOne({ name: workspaceName });
    if (existingWorkspace) {
        return res.status(409).json({ error: 'Workspace name already taken' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
    }

    const workspace = await Workspace.create({ name: workspaceName });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
        name,
        email,
        passwordHash,
        role: 'admin',
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

    if (!user.isActive) {
        return res.status(401).json({ error: 'Your account has been deactivated. Contact your administrator.' });
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

// GET /auth/invite/:token — validate token and return email + workspace name for pre-fill
router.get('/invite/:token', async (req, res) => {
    const invite = await Invite.findOne({
        token: req.params.token,
        used: false,
        expiresAt: { $gt: new Date() },
    }).populate<{ workspaceId: { name: string } }>('workspaceId', 'name');

    if (!invite) {
        return res.status(404).json({ error: 'Invite not found or expired' });
    }

    res.json({ email: invite.email, workspaceName: invite.workspaceId.name });
});

// POST /auth/accept-invite — create caseworker account from a valid invite token
router.post('/accept-invite', async (req, res) => {
    const { token, name, password } = req.body;

    if (!token || !name || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const invite = await Invite.findOne({
        token,
        used: false,
        expiresAt: { $gt: new Date() },
    });

    if (!invite) {
        return res.status(400).json({ error: 'Invite not found or expired' });
    }

    const existingUser = await User.findOne({ email: invite.email });
    if (existingUser) {
        return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
        name,
        email: invite.email,
        passwordHash,
        role: 'caseworker',
        workspaceId: invite.workspaceId,
    });

    // Mark invite used — prevents replay of the same link
    invite.used = true;
    await invite.save();

    const jwtToken = signToken({
        userId: user._id.toString(),
        workspaceId: invite.workspaceId.toString(),
        role: user.role,
    });

    res.status(201).json({
        token: jwtToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role, workspaceId: invite.workspaceId },
    });
});

export default router;