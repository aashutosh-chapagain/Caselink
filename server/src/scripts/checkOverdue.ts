import { Server } from 'socket.io';
import mongoose from 'mongoose';
import CaseModel from '../models/Case';
import User from '../models/User';
import Notification from '../models/Notification';
import Activity from '../models/Activity';

export async function checkOverdueCases(io: Server): Promise<void> {
    const now = new Date();

    const overdueCases = await CaseModel.find({
        status: { $in: ['open', 'in_progress'] },
        dueAt: { $lt: now, $ne: null },
        overdueNotifiedAt: null,
    }).populate('assignedTo', 'name');

    if (overdueCases.length === 0) return;

    console.log(`[overdue] Found ${overdueCases.length} case(s) to escalate`);

    for (const c of overdueCases) {
        const admins = await User.find({
            workspaceId: c.workspaceId,
            role: 'admin',
            isActive: true,
        }).select('_id');

        const recipientIds = new Set<string>(admins.map(a => a._id.toString()));
        if (c.assignedTo) {
            recipientIds.add((c.assignedTo as any)._id.toString());
        }

        const notifications = [...recipientIds].map(userId => ({
            userId: new mongoose.Types.ObjectId(userId),
            workspaceId: c.workspaceId,
            type: 'overdue',
            message: `Case overdue: "${c.title}"`,
            caseId: c._id,
        }));

        const created = await Notification.insertMany(notifications);

        for (const n of created) {
            io.to(`user:${n.userId}`).emit('notification:new', n);
        }

        await Activity.create({
            caseId: c._id,
            authorId: (c.assignedTo as any)?._id ?? admins[0]?._id,
            note: 'Case escalated — past due date',
            type: 'update',
            workspaceId: c.workspaceId,
        });

        await CaseModel.updateOne({ _id: c._id }, { overdueNotifiedAt: now });

        console.log(`[overdue] Escalated: "${c.title}" — notified ${recipientIds.size} user(s)`);
    }
}
