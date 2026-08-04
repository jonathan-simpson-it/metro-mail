/**
 * Upserts the default forwarding configuration:
 *  - `*` catch-all → lewis@st-anns.net + devanojo2@gmail.com
 * Keeps any existing per-alias rules (personal ones) untouched.
 *
 * Usage: node scripts/seed-routing.mjs
 */
import { loadEnvFile } from "node:process";
import mongoose from "mongoose";

const { connect, Schema, disconnect, model, models } = mongoose;

loadEnvFile(".env.local");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("MONGO_URI is not set (check .env.local).");
  process.exit(1);
}

const TEAM_FORWARD_TO = ["lewis@st-anns.net", "devanojo2@gmail.com"];

const routingRuleSchema = new Schema(
  {
    alias: { type: String, required: true, trim: true, unique: true },
    forwardTo: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const RoutingRule =
  models.RoutingRule ?? model("RoutingRule", routingRuleSchema);

await connect(MONGO_URI);

const catchAll = await RoutingRule.findOneAndUpdate(
  { alias: "*" },
  { $set: { forwardTo: TEAM_FORWARD_TO, active: true } },
  { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
).lean();

console.log("Catch-all rule:", {
  alias: catchAll.alias,
  forwardTo: catchAll.forwardTo,
  active: catchAll.active,
});

const all = await RoutingRule.find().sort({ createdAt: 1 }).lean();
console.log("\nAll rules now in the database:");
for (const rule of all) {
  console.log(
    `  ${rule.alias} → ${rule.forwardTo.join(", ")} (${rule.active ? "active" : "paused"})`,
  );
}

await disconnect();
