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
            description: 'Initial welfare check requested by local authority.',
            status: 'in_progress',
            priority: 'high',
            type: 'welfare_check',
            region: 'Northbridge, WA',
            address: '100 James Street, Northbridge WA 6003, Australia',
            lat: -31.9457,
            lng: 115.8605,
            assignedTo: caseworker._id,
            createdBy: admin._id,
            workspaceId: workspace._id,
        },
        {
            title: 'Case #1041 — Fremantle',
            description: 'Follow-up support session scheduled with family.',
            status: 'open',
            priority: 'medium',
            type: 'welfare_check',
            region: 'Fremantle, WA',
            address: '1 William Street, Fremantle WA 6160, Australia',
            lat: -32.0569,
            lng: 115.7439,
            assignedTo: admin._id,
            createdBy: admin._id,
            workspaceId: workspace._id,
        },
        {
            title: 'Bushfire — Kalamunda Hills',
            description: 'Vegetation fire spreading towards residential area. Evacuation in progress.',
            status: 'open',
            priority: 'critical',
            type: 'fire',
            region: 'Kalamunda, WA',
            address: 'Kalamunda Road, Kalamunda WA 6076, Australia',
            lat: -31.9749,
            lng: 116.0558,
            assignedTo: caseworker._id,
            createdBy: admin._id,
            workspaceId: workspace._id,
        },
        {
            title: 'Missing Person — Rockingham Beach',
            description: 'Teenager last seen at 6pm. Search and rescue coordinating with police.',
            status: 'in_progress',
            priority: 'critical',
            type: 'missing_person',
            region: 'Rockingham, WA',
            address: 'Rockingham Beach, Rockingham WA 6168, Australia',
            lat: -32.2779,
            lng: 115.7303,
            assignedTo: admin._id,
            createdBy: admin._id,
            workspaceId: workspace._id,
        },
        {
            title: 'Medical Assist — Midland',
            description: 'Elderly resident requiring home medical support after hospital discharge.',
            status: 'closed',
            priority: 'low',
            type: 'medical',
            region: 'Midland, WA',
            address: '274 Great Eastern Highway, Midland WA 6056, Australia',
            lat: -31.8935,
            lng: 116.0053,
            assignedTo: caseworker._id,
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