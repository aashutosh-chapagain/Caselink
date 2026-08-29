import mongoose, { Schema } from 'mongoose';

const alertSchema = new Schema({
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    region: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        radiusKm: { type: Number, required: true },
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
}, { timestamps: true });

export default mongoose.model('Alert', alertSchema);