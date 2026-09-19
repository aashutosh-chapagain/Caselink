import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../app';

// Required by signToken / verifyToken — not loaded via dotenv in test environment
process.env.JWT_SECRET = 'test-secret';

let mongod: MongoMemoryServer;

// Shared app instance with a no-op Socket.IO mock so route emissions don't throw
export const app = createApp();
app.set('io', {
    to: () => ({ emit: () => {} }),
});

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
    // Wipe all collections between tests so each test starts clean
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});
