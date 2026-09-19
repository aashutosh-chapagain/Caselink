import mongoose, { Schema } from 'mongoose';

const InviteSchema = new Schema({
    email: { type: String, required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// One active invite per email per workspace — upsert will replace the old one
InviteSchema.index({ email: 1, workspaceId: 1 });

export default mongoose.model('Invite', InviteSchema);
