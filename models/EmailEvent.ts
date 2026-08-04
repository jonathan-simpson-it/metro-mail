import mongoose, { Schema, type Model } from "mongoose";

export type EmailEventType =
  | "sent"
  | "delivered"
  | "bounced"
  | "opened"
  | "clicked"
  | "complained"
  | "delivery_delayed";

export interface IEmailEvent {
  eventId: string;
  resendEmailId: string;
  type: EmailEventType;
  url?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const emailEventSchema = new Schema<IEmailEvent>(
  {
    eventId: { type: String, required: true, unique: true },
    resendEmailId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: [
        "sent",
        "delivered",
        "bounced",
        "opened",
        "clicked",
        "complained",
        "delivery_delayed",
      ],
      required: true,
      index: true,
    },
    url: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true },
);

emailEventSchema.index({ type: 1, createdAt: -1 });
emailEventSchema.index({ createdAt: -1 });

export const EmailEvent: Model<IEmailEvent> =
  (mongoose.models.EmailEvent as Model<IEmailEvent>) ??
  mongoose.model<IEmailEvent>("EmailEvent", emailEventSchema);
