import mongoose, { Schema } from "mongoose";

const workspaceSchema = new Schema({
    name: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('Workspace', workspaceSchema);