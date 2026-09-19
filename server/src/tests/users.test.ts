import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './setup';
import { registerAdmin, registerCaseworker } from './helpers';

describe('GET /users/me', () => {
    it('returns the authenticated user with workspace name', async () => {
        const { token } = await registerAdmin();
        const res = await request(app)
            .get('/api/v1/users/me')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.email).toBe('admin@test.com');
        expect(res.body.role).toBe('admin');
        expect(res.body.workspaceName).toBe('Test Workspace');
    });

    it('returns 401 without a token', async () => {
        const res = await request(app).get('/api/v1/users/me');
        expect(res.status).toBe(401);
    });
});

describe('PATCH /users/me', () => {
    it('updates the user name', async () => {
        const { token } = await registerAdmin();
        const res = await request(app)
            .patch('/api/v1/users/me')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Updated Name' });
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated Name');
    });

    it('rejects an empty name', async () => {
        const { token } = await registerAdmin();
        const res = await request(app)
            .patch('/api/v1/users/me')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: '   ' });
        expect(res.status).toBe(400);
    });

    it('caseworker can update their own name', async () => {
        const { token: adminToken } = await registerAdmin();
        const { token: workerToken } = await registerCaseworker(adminToken);
        const res = await request(app)
            .patch('/api/v1/users/me')
            .set('Authorization', `Bearer ${workerToken}`)
            .send({ name: 'New Worker Name' });
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('New Worker Name');
    });
});

describe('PATCH /users/me/password', () => {
    it('changes password with correct current password', async () => {
        const { token } = await registerAdmin();
        const res = await request(app)
            .patch('/api/v1/users/me/password')
            .set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: 'password123', newPassword: 'newpassword456' });
        expect(res.status).toBe(200);

        // Verify new password works
        const loginRes = await request(app).post('/api/v1/auth/login').send({
            email: 'admin@test.com',
            password: 'newpassword456',
        });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body.token).toBeTruthy();
    });

    it('rejects wrong current password', async () => {
        const { token } = await registerAdmin();
        const res = await request(app)
            .patch('/api/v1/users/me/password')
            .set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' });
        expect(res.status).toBe(401);
    });

    it('rejects new password shorter than 8 characters', async () => {
        const { token } = await registerAdmin();
        const res = await request(app)
            .patch('/api/v1/users/me/password')
            .set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: 'password123', newPassword: 'short' });
        expect(res.status).toBe(400);
    });

    it('rejects missing fields', async () => {
        const { token } = await registerAdmin();
        const res = await request(app)
            .patch('/api/v1/users/me/password')
            .set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: 'password123' });
        expect(res.status).toBe(400);
    });
});

describe('GET /users', () => {
    it('returns all users in workspace', async () => {
        const { token: adminToken } = await registerAdmin();
        await registerCaseworker(adminToken);

        const res = await request(app)
            .get('/api/v1/users')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
    });

    it('does not return users from other workspaces', async () => {
        const { token: adminA } = await registerAdmin({ workspaceName: 'WS-A', email: 'a@test.com' });
        await registerAdmin({ workspaceName: 'WS-B', email: 'b@test.com' });

        const res = await request(app)
            .get('/api/v1/users')
            .set('Authorization', `Bearer ${adminA}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].email).toBe('a@test.com');
    });
});
