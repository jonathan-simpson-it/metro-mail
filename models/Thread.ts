import mongoose, { Schema, type Model } from "mongoose";

export interface IThread {
  subject: string;
  normalizedSubject: string;
  participants: string[];
  snippet: string;
  lastMessageAt: Date;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const threadSchema = new Schema<IThread>(
  {
    subject: { type: String, required: true, trim: true },
    normalizedSubject: { type: String, required: true },
    participants: { type: [String], default: [] },
    snippet: { type: String, default: "" },
    lastMessageAt: { type: Date, required: true },
    messageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

threadSchema.index({ lastMessageAt: -1 });
threadSchema.index({ normalizedSubject: 1, participants: 1 });

export const Thread: Model<IThread> =
  (mongoose.models.Thread as Model<IThread>) ??
  mongoose.model<IThread>("Thread", threadSchema);
