import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

export interface AuthedRequest extends Request {
    userId?: string;
    workspaceId?: string;
    role?: 'admin' | 'caseworker';
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const token = header.split(' ')[1];
        const payload = verifyToken(token);
        req.userId = payload.userId;
        req.workspaceId = payload.workspaceId;
        req.role = payload.role;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
    if (req.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}