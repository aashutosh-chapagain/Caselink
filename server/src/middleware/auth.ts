import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import User from '../models/User';

export interface AuthedRequest extends Request {
    userId?: string;
    workspaceId?: string;
    role?: 'admin' | 'caseworker';
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authedReq = req as AuthedRequest;
    const header = authedReq.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const token = header.slice(7);
        const payload = verifyToken(token);

        const user = await User.findById(payload.userId).select('isActive');
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Account is deactivated' });
        }

        authedReq.userId = payload.userId;
        authedReq.workspaceId = payload.workspaceId;
        authedReq.role = payload.role;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if ((req as AuthedRequest).role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}