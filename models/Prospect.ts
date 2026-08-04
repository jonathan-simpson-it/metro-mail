import mongoose, { Schema, type Model } from "mongoose";

export type ProspectStatus = "draft" | "sent" | "replied" | "skipped";

export interface IProspect {
  name: string;
  company: string;
  email: string;
  role: string;
  listing: string;
  notes: string;
  context: string;
  valueLine: string;
  status: ProspectStatus;
  sentAt?: Date;
  threadId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const prospectSchema = new Schema<IProspect>(
  {
    name: { type: String, required: true },
    company: { type: String, default: "" },
    email: { type: String, required: true },
    role: { type: String, default: "" },
    listing: { type: String, default: "" },
    notes: { type: String, default: "" },
    context: { type: String, default: "" },
    valueLine: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "sent", "replied", "skipped"],
      default: "draft",
      index: true,
    },
    sentAt: { type: Date },
    threadId: { type: String },
  },
  { timestamps: true },
);

prospectSchema.index({ email: 1 }, { unique: true });
prospectSchema.index({ createdAt: -1 });

export const Prospect: Model<IProspect> =
  (mongoose.models.Prospect as Model<IProspect>) ??
  mongoose.model<IProspect>("Prospect", prospectSchema);
