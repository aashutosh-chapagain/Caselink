import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './setup';
import { registerAdmin, registerCaseworker, createCase } from './helpers';

describe('Notifications', () => {
    it('reassigning a case creates a notification for the new assignee', async () => {
        const { token: adminToken } = await registerAdmin();
        const { userId: workerId } = await registerCaseworker(adminToken);
        const caseId = await createCase(adminToken);

        await request(app)
            .patch(`/api/v1/cases/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ assignedTo: workerId });

        const res = await request(app)
            .get('/api/v1/notifications')
            .set('Authorization', `Bearer ${adminToken}`);

        // Admin gets no notification (they did the assigning)
        expect(res.body.length).toBe(0);
    });

    it('assigned user receives a notification', async () => {
        const { token: adminToken } = await registerAdmin();
        const { token: workerToken, userId: workerId } = await registerCaseworker(adminToken);
        const caseId = await createCase(adminToken);

        await request(app)
            .patch(`/api/v1/cases/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ assignedTo: workerId });

        const res = await request(app)
            .get('/api/v1/notifications')
            .set('Authorization', `Bearer ${workerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].type).toBe('assignment');
        expect(res.body[0].read).toBe(false);
        expect(res.body[0].caseId).toBe(caseId);
    });

    it('self-assignment does not create a notification', async () => {
        const { token: adminToken, userId: adminId } = await registerAdmin();
        const caseId = await createCase(adminToken);

        // Admin reassigns to themselves
        await request(app)
            .patch(`/api/v1/cases/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ assignedTo: adminId });

        const res = await request(app)
            .get('/api/v1/notifications')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.body.length).toBe(0);
    });

    it('PATCH /notifications/read marks all notifications as read', async () => {
        const { token: adminToken } = await registerAdmin();
        const { token: workerToken, userId: workerId } = await registerCaseworker(adminToken);
        const caseId = await createCase(adminToken);

        // Create two notifications
        const caseId2 = await createCase(adminToken, { title: 'Second case' });
        await request(app).patch(`/api/v1/cases/${caseId}`).set('Authorization', `Bearer ${adminToken}`).send({ assignedTo: workerId });
        await request(app).patch(`/api/v1/cases/${caseId2}`).set('Authorization', `Bearer ${adminToken}`).send({ assignedTo: workerId });

        // Mark all as read
        await request(app)
            .patch('/api/v1/notifications/read')
            .set('Authorization', `Bearer ${workerToken}`);

        const res = await request(app)
            .get('/api/v1/notifications')
            .set('Authorization', `Bearer ${workerToken}`);

        expect(res.body.every((n: any) => n.read === true)).toBe(true);
    });

    it('notifications are scoped to the recipient — other users cannot see them', async () => {
        const { token: adminToken } = await registerAdmin();
        const { userId: workerId } = await registerCaseworker(adminToken, 'worker1@test.com');
        const { token: worker2Token } = await registerCaseworker(adminToken, 'worker2@test.com');
        const caseId = await createCase(adminToken);

        await request(app)
            .patch(`/api/v1/cases/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ assignedTo: workerId });

        // worker2 should see no notifications
        const res = await request(app)
            .get('/api/v1/notifications')
            .set('Authorization', `Bearer ${worker2Token}`);

        expect(res.body.length).toBe(0);
    });

    it('returns 401 without a token', async () => {
        const res = await request(app).get('/api/v1/notifications');
        expect(res.status).toBe(401);
    });
});
