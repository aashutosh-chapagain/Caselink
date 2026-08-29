import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import Workspace from '../models/Workspace';
import User from '../models/User';
import CaseModel from '../models/Case';

dotenv.config();

async function seed() {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('Connected. Clearing existing data...');

    await Promise.all([
        Workspace.deleteMany({}),
        User.deleteMany({}),
        CaseModel.deleteMany({}),
    ]);

    const workspace = await Workspace.create({ name: 'DFES Perth Metro' });

    const passwordHash = await bcrypt.hash('password123', 10);

    const admin = await User.create({
        name: 'Ash Admin',
        email: 'admin@caselink.test',
        passwordHash,
        role: 'admin',
        workspaceId: workspace._id,
    });

    const caseworker = await User.create({
        name: 'Jamie Caseworker',
        email: 'caseworker@caselink.test',
        passwordHash,
        role: 'caseworker',
        workspaceId: workspace._id,
    });

    await CaseModel.create([
        {
            title: 'Case #1042 — Northbridge',
            description: 'Initial welfare check requested.',
            status: 'in_progress',
            region: 'Northbridge, WA',
            assignedTo: caseworker._id,
            createdBy: admin._id,
            workspaceId: workspace._id,
        },
        {
            title: 'Case #1041 — Fremantle',
            description: 'Follow-up support session scheduled.',
            status: 'open',
            region: 'Fremantle, WA',
            assignedTo: admin._id,
            createdBy: admin._id,
            workspaceId: workspace._id,
        },
    ]);

    console.log('Seed complete. Admin login: admin@caselink.test / password123');
    await mongoose.disconnect();
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});