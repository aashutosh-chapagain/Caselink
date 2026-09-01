import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth';
import caseRoutes from './routes/cases';
import activityRoutes from './routes/activities';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.set('io', io); // Make the Socket.IO instance available in routes

// Socket auth middleware - runs on every connection attempt
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
            userId: string;
            workspaceId: string;
            role: string;
        }
        socket.data.userId = payload.userId;
        socket.data.workspaceId = payload.workspaceId;
        socket.data.role = payload.role;
        next();
    } catch (err) {
        console.error('Socket auth error:', err);
        next(new Error('Invalid token'));
    }
});

io.on('connection', (socket) => {
    const workspaceRoom = `workspace:${socket.data.workspaceId}`;
    const userRoom = `user:${socket.data.userId}`;

    socket.join(workspaceRoom);
    socket.join(userRoom);

    console.log(`Socket connected: user ${socket.data.userId}, joined ${workspaceRoom}`);

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: user ${socket.data.userId}`);
    });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/cases', caseRoutes);
app.use('/api/v1/cases', activityRoutes);
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI as string)
    .then(() => {
        console.log('MongoDB connected');
        httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
    });