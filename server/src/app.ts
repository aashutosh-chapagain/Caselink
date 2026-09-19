import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import caseRoutes from './routes/cases';
import activityRoutes from './routes/activities';
import userRoutes from './routes/users';
import dashboardRoutes from './routes/dashboard';
import alertRoutes from './routes/alerts';
import inviteRoutes from './routes/invites';

export function createApp() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/users', userRoutes);
    app.use('/api/v1/cases', caseRoutes);
    app.use('/api/v1/cases', activityRoutes);
    app.use('/api/v1/dashboard', dashboardRoutes);
    app.use('/api/v1/alerts', alertRoutes);
    app.use('/api/v1/invites', inviteRoutes);
    app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });

    return app;
}
