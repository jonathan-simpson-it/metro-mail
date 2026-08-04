import mongoose, { Schema, type Model } from "mongoose";

export interface IRoutingRule {
  /** Local part ("lewis") or full address ("lewis@mail.jonathansimpson.co"). "*" = catch-all. */
  alias: string;
  /** Destination mailboxes to forward matching email to. */
  forwardTo: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const routingRuleSchema = new Schema<IRoutingRule>(
  {
    alias: { type: String, required: true, trim: true, unique: true },
    forwardTo: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const RoutingRule: Model<IRoutingRule> =
  (mongoose.models.RoutingRule as Model<IRoutingRule>) ??
  mongoose.model<IRoutingRule>("RoutingRule", routingRuleSchema);
