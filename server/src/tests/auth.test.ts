import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './setup';
import { registerAdmin } from './helpers';

describe('POST /auth/register', () => {
    it('creates a workspace and admin, returns a token', async () => {
        const res = await request(app).post('/api/v1/auth/register').send({
            name: 'Alice',
            email: 'alice@test.com',
            password: 'password123',
            workspaceName: 'Workspace A',
        });
        expect(res.status).toBe(201);
        expect(res.body.token).toBeTruthy();
        expect(res.body.user.role).toBe('admin');
    });

    it('rejects a duplicate workspace name', async () => {
        await registerAdmin({ workspaceName: 'Taken Name' });
        const res = await request(app).post('/api/v1/auth/register').send({
            name: 'Bob',
            email: 'bob@test.com',
            password: 'password123',
            workspaceName: 'Taken Name',
        });
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/workspace/i);
    });

    it('rejects a duplicate email', async () => {
        await registerAdmin({ email: 'same@test.com', workspaceName: 'WS1' });
        const res = await request(app).post('/api/v1/auth/register').send({
            name: 'Clone',
            email: 'same@test.com',
            password: 'password123',
            workspaceName: 'WS2',
        });
        expect(res.status).toBe(409);
    });

    it('rejects passwords shorter than 8 characters', async () => {
        const res = await request(app).post('/api/v1/auth/register').send({
            name: 'Short',
            email: 'short@test.com',
            password: '123',
            workspaceName: 'WS3',
        });
        expect(res.status).toBe(400);
    });
});

describe('POST /auth/login', () => {
    it('returns a token with valid credentials', async () => {
        await registerAdmin();
        const res = await request(app).post('/api/v1/auth/login').send({
            email: 'admin@test.com',
            password: 'password123',
        });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
    });

    it('rejects wrong password', async () => {
        await registerAdmin();
        const res = await request(app).post('/api/v1/auth/login').send({
            email: 'admin@test.com',
            password: 'wrongpassword',
        });
        expect(res.status).toBe(401);
    });

    it('rejects unknown email', async () => {
        const res = await request(app).post('/api/v1/auth/login').send({
            email: 'nobody@test.com',
            password: 'password123',
        });
        expect(res.status).toBe(401);
    });
});

describe('Invite flow', () => {
    it('admin creates an invite link', async () => {
        const { token } = await registerAdmin();
        const res = await request(app)
            .post('/api/v1/invites')
            .set('Authorization', `Bearer ${token}`)
            .send({ email: 'worker@test.com' });
        expect(res.status).toBe(201);
        expect(res.body.inviteUrl).toContain('/accept-invite?token=');
    });

    it('caseworker cannot create invites', async () => {
        const { token: adminToken } = await registerAdmin();

        // Create caseworker via invite
        const inviteRes = await request(app)
            .post('/api/v1/invites')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: 'worker@test.com' });
        const url = new URL(inviteRes.body.inviteUrl);
        const inviteToken = url.searchParams.get('token') as string;
        const acceptRes = await request(app).post('/api/v1/auth/accept-invite').send({
            token: inviteToken,
            name: 'Worker',
            password: 'password123',
        });
        const workerToken = acceptRes.body.token;

        // Caseworker tries to invite someone
        const res = await request(app)
            .post('/api/v1/invites')
            .set('Authorization', `Bearer ${workerToken}`)
            .send({ email: 'another@test.com' });
        expect(res.status).toBe(403);
    });

    it('GET /auth/invite/:token returns email and workspace name', async () => {
        const { token: adminToken } = await registerAdmin();
        const inviteRes = await request(app)
            .post('/api/v1/invites')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: 'worker@test.com' });
        const url = new URL(inviteRes.body.inviteUrl);
        const inviteToken = url.searchParams.get('token') as string;

        const res = await request(app).get(`/api/v1/auth/invite/${inviteToken}`);
        expect(res.status).toBe(200);
        expect(res.body.email).toBe('worker@test.com');
        expect(res.body.workspaceName).toBe('Test Workspace');
    });

    it('returns 404 for an invalid invite token', async () => {
        const res = await request(app).get('/api/v1/auth/invite/not-a-real-token');
        expect(res.status).toBe(404);
    });

    it('accept-invite creates a caseworker and returns a token', async () => {
        const { token: adminToken } = await registerAdmin();
        const inviteRes = await request(app)
            .post('/api/v1/invites')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: 'worker@test.com' });
        const url = new URL(inviteRes.body.inviteUrl);
        const inviteToken = url.searchParams.get('token') as string;

        const res = await request(app).post('/api/v1/auth/accept-invite').send({
            token: inviteToken,
            name: 'New Worker',
            password: 'password123',
        });
        expect(res.status).toBe(201);
        expect(res.body.user.role).toBe('caseworker');
        expect(res.body.token).toBeTruthy();
    });

    it('rejects replaying a used invite token', async () => {
        const { token: adminToken } = await registerAdmin();
        const inviteRes = await request(app)
            .post('/api/v1/invites')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: 'worker@test.com' });
        const url = new URL(inviteRes.body.inviteUrl);
        const inviteToken = url.searchParams.get('token') as string;

        // First use — should succeed
        await request(app).post('/api/v1/auth/accept-invite').send({
            token: inviteToken, name: 'Worker', password: 'password123',
        });

        // Replay — should fail
        const res = await request(app).post('/api/v1/auth/accept-invite').send({
            token: inviteToken, name: 'Attacker', password: 'password123',
        });
        expect(res.status).toBe(400);
    });
});
