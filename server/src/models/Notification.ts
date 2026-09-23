import mongoose, { Schema } from 'mongoose';

const NotificationSchema = new Schema({
    userId:      { type: Schema.Types.ObjectId, ref: 'User',      required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    type:        { type: String, enum: ['assignment'], required: true },
    message:     { type: String, required: true },
    caseId:      { type: Schema.Types.ObjectId, ref: 'Case',      required: true },
    read:        { type: Boolean, default: false },
}, { timestamps: true });

NotificationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Notification', NotificationSchema);
