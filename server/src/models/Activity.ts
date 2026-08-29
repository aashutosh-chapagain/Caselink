import mongoose, { Schema } from 'mongoose';

const activitySchema = new Schema({
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, required: true },
    type: { type: String, enum: ['note', 'status_change', 'assignment'], default: 'note' },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
}, { timestamps: true });

export default mongoose.model('Activity', activitySchema);