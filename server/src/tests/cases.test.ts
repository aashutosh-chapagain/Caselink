import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './setup';
import { registerAdmin, registerCaseworker, createCase } from './helpers';

describe('POST /cases', () => {
    it('admin can create a case', async () => {
        const { token } = await registerAdmin();
        const res = await request(app)
            .post('/api/v1/cases')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Fire on Main St', description: 'Smoke visible', region: 'Perth', type: 'fire', priority: 'high' });
        expect(res.status).toBe(201);
        expect(res.body.title).toBe('Fire on Main St');
        expect(res.body.priority).toBe('high');
        expect(res.body.status).toBe('open');
    });

    it('caseworker can create a case', async () => {
        const { token: adminToken } = await registerAdmin();
        const { token: workerToken } = await registerCaseworker(adminToken);
        const res = await request(app)
            .post('/api/v1/cases')
            .set('Authorization', `Bearer ${workerToken}`)
            .send({ title: 'Welfare check', description: 'Elderly resident', region: 'Fremantle', type: 'welfare_check' });
        expect(res.status).toBe(201);
    });

    it('rejects missing required fields', async () => {
        const { token } = await registerAdmin();
        const res = await request(app)
            .post('/api/v1/cases')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'No description' });
        expect(res.status).toBe(400);
    });

    it('rejects invalid type', async () => {
        const { token } = await registerAdmin();
        const res = await request(app)
            .post('/api/v1/cases')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Bad type', description: 'desc', region: 'Perth', type: 'earthquake' });
        expect(res.status).toBe(400);
    });

    it('rejects invalid priority', async () => {
        const { token } = await registerAdmin();
        const res = await request(app)
            .post('/api/v1/cases')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Bad prio', description: 'desc', region: 'Perth', type: 'fire', priority: 'urgent' });
        expect(res.status).toBe(400);
    });

    it('rejects unauthenticated request', async () => {
        const res = await request(app)
            .post('/api/v1/cases')
            .send({ title: 'No auth', description: 'desc', region: 'Perth', type: 'fire' });
        expect(res.status).toBe(401);
    });
});

describe('GET /cases', () => {
    it('admin sees all cases in workspace', async () => {
        const { token: adminToken } = await registerAdmin();
        const { token: workerToken } = await registerCaseworker(adminToken);
        await createCase(adminToken);
        await createCase(workerToken, { title: 'Worker Case' });

        const res = await request(app)
            .get('/api/v1/cases')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.cases.length).toBe(2);
    });

    it('caseworker only sees their own cases', async () => {
        const { token: adminToken } = await registerAdmin();
        const { token: workerToken, userId: workerId } = await registerCaseworker(adminToken);
        await createCase(adminToken, { title: 'Admin Case' });
        await createCase(workerToken, { title: 'Worker Case' });

        const res = await request(app)
            .get('/api/v1/cases')
            .set('Authorization', `Bearer ${workerToken}`);
        expect(res.status).toBe(200);
        // Caseworker only sees their own case (assignedTo === workerId)
        expect(res.body.cases.length).toBe(1);
        expect(res.body.cases[0].title).toBe('Worker Case');
    });

    it('workspace isolation — different workspace cases not visible', async () => {
        const { token: adminA } = await registerAdmin({ workspaceName: 'WS-A', email: 'a@test.com' });
        const { token: adminB } = await registerAdmin({ workspaceName: 'WS-B', email: 'b@test.com' });
        await createCase(adminA, { title: 'WS-A Case' });
        await createCase(adminB, { title: 'WS-B Case' });

        const resA = await request(app)
            .get('/api/v1/cases')
            .set('Authorization', `Bearer ${adminA}`);
        expect(resA.body.cases.length).toBe(1);
        expect(resA.body.cases[0].title).toBe('WS-A Case');

        const resB = await request(app)
            .get('/api/v1/cases')
            .set('Authorization', `Bearer ${adminB}`);
        expect(resB.body.cases.length).toBe(1);
        expect(resB.body.cases[0].title).toBe('WS-B Case');
    });

    it('status filter works', async () => {
        const { token } = await registerAdmin();
        const caseId = await createCase(token);
        // Close the case
        await request(app)
            .patch(`/api/v1/cases/${caseId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'closed' });

        const openRes = await request(app)
            .get('/api/v1/cases?status=open')
            .set('Authorization', `Bearer ${token}`);
        expect(openRes.body.cases.length).toBe(0);

        const closedRes = await request(app)
            .get('/api/v1/cases?status=closed')
            .set('Authorization', `Bearer ${token}`);
        expect(closedRes.body.cases.length).toBe(1);
    });
});

describe('GET /cases/:id', () => {
    it('returns a case by id', async () => {
        const { token } = await registerAdmin();
        const caseId = await createCase(token);
        const res = await request(app)
            .get(`/api/v1/cases/${caseId}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body._id).toBe(caseId);
    });

    it('returns 404 for a case in another workspace', async () => {
        const { token: adminA } = await registerAdmin({ workspaceName: 'WS-A', email: 'a@test.com' });
        const { token: adminB } = await registerAdmin({ workspaceName: 'WS-B', email: 'b@test.com' });
        const caseId = await createCase(adminA);

        const res = await request(app)
            .get(`/api/v1/cases/${caseId}`)
            .set('Authorization', `Bearer ${adminB}`);
        expect(res.status).toBe(404);
    });
});

describe('PATCH /cases/:id', () => {
    it('updates case status and logs an activity', async () => {
        const { token } = await registerAdmin();
        const caseId = await createCase(token);

        const res = await request(app)
            .patch(`/api/v1/cases/${caseId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'in_progress' });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('in_progress');
    });

    it('caseworker cannot reassign a case', async () => {
        const { token: adminToken } = await registerAdmin();
        const { token: workerToken, userId: workerId } = await registerCaseworker(adminToken);
        const caseId = await createCase(workerToken);

        const res = await request(app)
            .patch(`/api/v1/cases/${caseId}`)
            .set('Authorization', `Bearer ${workerToken}`)
            .send({ assignedTo: workerId });
        expect(res.status).toBe(403);
    });

    it('admin can reassign a case', async () => {
        const { token: adminToken } = await registerAdmin();
        const { userId: workerId } = await registerCaseworker(adminToken);
        const caseId = await createCase(adminToken);

        const res = await request(app)
            .patch(`/api/v1/cases/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ assignedTo: workerId });
        expect(res.status).toBe(200);
        expect(res.body.assignedTo._id).toBe(workerId);
    });

    it('returns 404 for a case in another workspace', async () => {
        const { token: adminA } = await registerAdmin({ workspaceName: 'WS-A', email: 'a@test.com' });
        const { token: adminB } = await registerAdmin({ workspaceName: 'WS-B', email: 'b@test.com' });
        const caseId = await createCase(adminA);

        const res = await request(app)
            .patch(`/api/v1/cases/${caseId}`)
            .set('Authorization', `Bearer ${adminB}`)
            .send({ status: 'closed' });
        expect(res.status).toBe(404);
    });

    it('rejects invalid status', async () => {
        const { token } = await registerAdmin();
        const caseId = await createCase(token);
        const res = await request(app)
            .patch(`/api/v1/cases/${caseId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'deleted' });
        expect(res.status).toBe(400);
    });
});

describe('GET /cases?search=', () => {
    it('returns cases matching the title', async () => {
        const { token } = await registerAdmin();
        await createCase(token, { title: 'Fire on Main Street' });
        await createCase(token, { title: 'Welfare check — elderly resident' });

        const res = await request(app)
            .get('/api/v1/cases?search=fire')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.cases.length).toBe(1);
        expect(res.body.cases[0].title).toBe('Fire on Main Street');
    });

    it('search is case-insensitive', async () => {
        const { token } = await registerAdmin();
        await createCase(token, { title: 'HAZMAT Incident' });

        const res = await request(app)
            .get('/api/v1/cases?search=hazmat')
            .set('Authorization', `Bearer ${token}`);
        expect(res.body.cases.length).toBe(1);
    });

    it('matches on region', async () => {
        const { token } = await registerAdmin();
        await createCase(token, { title: 'Case A', region: 'Fremantle' });
        await createCase(token, { title: 'Case B', region: 'Perth CBD' });

        const res = await request(app)
            .get('/api/v1/cases?search=fremantle')
            .set('Authorization', `Bearer ${token}`);
        expect(res.body.cases.length).toBe(1);
        expect(res.body.cases[0].title).toBe('Case A');
    });

    it('returns empty array when nothing matches', async () => {
        const { token } = await registerAdmin();
        await createCase(token, { title: 'Routine check' });

        const res = await request(app)
            .get('/api/v1/cases?search=zzznomatch')
            .set('Authorization', `Bearer ${token}`);
        expect(res.body.cases.length).toBe(0);
    });

    it('search composes with status filter', async () => {
        const { token } = await registerAdmin();
        const caseId = await createCase(token, { title: 'Fire incident alpha' });
        await createCase(token, { title: 'Fire incident beta' });
        // Close one of the fire cases
        await request(app)
            .patch(`/api/v1/cases/${caseId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'closed' });

        const res = await request(app)
            .get('/api/v1/cases?search=fire&status=open')
            .set('Authorization', `Bearer ${token}`);
        expect(res.body.cases.length).toBe(1);
        expect(res.body.cases[0].title).toBe('Fire incident beta');
    });

    it('does not return matching cases from another workspace', async () => {
        const { token: adminA } = await registerAdmin({ workspaceName: 'WS-A', email: 'a@test.com' });
        const { token: adminB } = await registerAdmin({ workspaceName: 'WS-B', email: 'b@test.com' });
        await createCase(adminA, { title: 'Rescue operation' });
        await createCase(adminB, { title: 'Rescue operation' });

        const res = await request(app)
            .get('/api/v1/cases?search=rescue')
            .set('Authorization', `Bearer ${adminA}`);
        expect(res.body.cases.length).toBe(1);
    });
});
