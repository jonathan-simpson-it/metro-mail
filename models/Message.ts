import mongoose, { Schema, type Model } from "mongoose";

export interface AttachmentMeta {
  id?: string;
  filename: string;
  contentType?: string;
  contentDisposition?: string;
  contentId?: string;
  size?: number;
}

export interface IMessage {
  threadId: mongoose.Types.ObjectId;
  resendEmailId?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  sender: { name?: string; email: string };
  recipients: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody?: string;
  textBody?: string;
  direction: "inbound" | "outbound";
  attachments: AttachmentMeta[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "Thread",
      required: true,
    },
    resendEmailId: { type: String, unique: true, sparse: true },
    messageId: { type: String, index: true, sparse: true },
    inReplyTo: { type: String },
    references: { type: [String], default: [] },
    sender: {
      name: { type: String },
      email: { type: String, required: true },
    },
    recipients: { type: [String], default: [] },
    cc: { type: [String], default: [] },
    bcc: { type: [String], default: [] },
    subject: { type: String, default: "" },
    htmlBody: { type: String },
    textBody: { type: String },
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    attachments: [
      {
        id: String,
        filename: { type: String, required: true },
        contentType: String,
        contentDisposition: String,
        contentId: String,
        size: Number,
      },
    ],
  },
  { timestamps: true },
);

messageSchema.index({ threadId: 1, createdAt: 1 });
messageSchema.index({ direction: 1, "sender.email": 1, createdAt: 1 });

export const Message: Model<IMessage> =
  (mongoose.models.Message as Model<IMessage>) ??
  mongoose.model<IMessage>("Message", messageSchema);
