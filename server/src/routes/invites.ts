import { Router } from 'express';
import crypto from 'crypto';
import Invite from '../models/Invite';
import { requireAuth, requireAdmin, type AuthedRequest } from '../middleware/auth';

const router = Router();

router.use(requireAuth, requireAdmin);

// POST /invites — create or replace an invite for an email address
router.post('/', async (req, res) => {
    const { email } = req.body;
    const authedReq = req as AuthedRequest;

    if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Upsert: if this email already has a pending invite in this workspace, replace it
    await Invite.findOneAndUpdate(
        { email: email.toLowerCase(), workspaceId: authedReq.workspaceId },
        { token, expiresAt, used: false, createdBy: authedReq.userId },
        { upsert: true, returnDocument: 'after' },
    );

    const inviteUrl = `${process.env.CLIENT_URL ?? 'http://localhost:5173'}/accept-invite?token=${token}`;

    res.status(201).json({ inviteUrl });
});

// GET /invites — list pending (unused, not expired) invites for this workspace
router.get('/', async (req, res) => {
    const authedReq = req as AuthedRequest;

    const invites = await Invite.find({
        workspaceId: authedReq.workspaceId,
        used: false,
        expiresAt: { $gt: new Date() },
    })
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });

    res.json(invites);
});

// DELETE /invites/:id — revoke a pending invite
router.delete('/:id', async (req, res) => {
    const authedReq = req as AuthedRequest;

    const invite = await Invite.findOneAndDelete({
        _id: req.params.id,
        workspaceId: authedReq.workspaceId,
        used: false,
    });

    if (!invite) {
        return res.status(404).json({ error: 'Invite not found' });
    }

    res.json({ message: 'Invite revoked' });
});

export default router;
