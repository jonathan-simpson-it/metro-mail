import mongoose, { Schema, type Model } from "mongoose";

export interface ITemplate {
  name: string;
  slug: string;
  description: string;
  category: "cold-outreach" | "follow-up" | "proposal" | "internal" | "blank";
  html: string;
  tokens: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new Schema<ITemplate>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    category: {
      type: String,
      enum: ["cold-outreach", "follow-up", "proposal", "internal", "blank"],
      default: "internal",
    },
    html: { type: String, required: true },
    tokens: { type: [String], default: [] },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Template: Model<ITemplate> =
  (mongoose.models.Template as Model<ITemplate>) ??
  mongoose.model<ITemplate>("Template", templateSchema);
