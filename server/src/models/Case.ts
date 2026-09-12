import mongoose, { Schema } from "mongoose";

const caseSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['open', 'in_progress', 'closed'], default: 'open' },
    priority: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
    type: {
        type: String,
        enum: ['fire', 'medical', 'welfare_check', 'missing_person', 'hazmat', 'rescue', 'other'],
        required: true,
    },
    region: { type: String, required: true },
    address: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
}, { timestamps: true });

caseSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('Case', caseSchema);