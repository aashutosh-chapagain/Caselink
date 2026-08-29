import jwt from 'jsonwebtoken';

interface TokenPayload {
    userId: string;
    workspaceId: string;
    role: 'admin' | 'caseworker';
}

export function signToken(payload: TokenPayload): string {
    return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload {
    return jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
}