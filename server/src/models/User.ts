import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'caseworker'], required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
}, { timestamps: true });

export default mongoose.model('User', UserSchema);