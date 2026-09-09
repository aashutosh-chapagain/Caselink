import { Router } from 'express';
import User from '../models/User';
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

export default router;
