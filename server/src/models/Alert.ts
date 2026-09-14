import mongoose, { Schema } from 'mongoose';

const alertSchema = new Schema({
    message: { type: String, required: true },
    severity: {
        type: String,
        enum: ['critical', 'high', 'medium', 'info'],
        default: 'info',
    },
    region: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
}, { timestamps: true });

alertSchema.index({ workspaceId: 1, isActive: 1 });

export default mongoose.model('Alert', alertSchema);