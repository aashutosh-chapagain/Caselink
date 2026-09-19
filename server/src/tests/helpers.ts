import request from 'supertest';
import { app } from './setup';

// Register a new workspace + admin, return token and user id
export async function registerAdmin(overrides: { workspaceName?: string; email?: string } = {}) {
    const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test Admin',
        email: overrides.email ?? 'admin@test.com',
        password: 'password123',
        workspaceName: overrides.workspaceName ?? 'Test Workspace',
    });
    return { token: res.body.token as string, userId: res.body.user.id as string, workspaceId: res.body.user.workspaceId as string };
}

// Create a caseworker via the invite flow, return their token
export async function registerCaseworker(adminToken: string, email = 'worker@test.com') {
    // Admin creates invite
    const inviteRes = await request(app)
        .post('/api/v1/invites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email });

    const url = new URL(inviteRes.body.inviteUrl);
    const token = url.searchParams.get('token') as string;

    // Caseworker accepts invite
    const acceptRes = await request(app).post('/api/v1/auth/accept-invite').send({
        token,
        name: 'Test Caseworker',
        password: 'password123',
    });

    return { token: acceptRes.body.token as string, userId: acceptRes.body.user.id as string };
}

// Create a case as a given user, return the case id
export async function createCase(userToken: string, overrides: Record<string, unknown> = {}) {
    const res = await request(app)
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
            title: 'Test Case',
            description: 'A test case',
            region: 'Perth',
            priority: 'medium',
            type: 'other',
            ...overrides,
        });
    return res.body._id as string;
}
