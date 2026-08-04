/**
 * Estimated sender-warmth score for mail.jonathansimpson.co.
 *
 * The true reputation lives inside mailbox providers (Google Postmaster,
 * Microsoft SNDS, Validity Sender Score) and cannot be read programmatically
 * from here — this is an honest estimate from locally verifiable signals,
 * labelled as such in the UI.
 */

export interface WarmthInputs {
  recordsVerified: boolean;
  historyDays: number;
  activeDays14: number; // days with at least one send in the last 14
  sent30: number;
  bounced30: number;
  complained30: number;
  uniqueOpens30: number;
  maxDayVolume30: number;
  avgDayVolume30: number;
  trackingEnabled: boolean;
}

export interface WarmthFactor {
  label: string;
  weight: number;
  earned: number;
  note: string;
}

export type WarmthState = "Cold" | "Warming" | "Warm" | "Hot";

export interface WarmthResult {
  score: number;
  state: WarmthState;
  factors: WarmthFactor[];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function computeWarmth(input: WarmthInputs): WarmthResult {
  const factors: WarmthFactor[] = [];

  // 1. Authentication records verified (hard gate) — 25 pts
  const records = input.recordsVerified ? 25 : 0;
  factors.push({
    label: "Authentication records verified",
    weight: 25,
    earned: records,
    note: input.recordsVerified
      ? "SPF, DKIM and MX verified by Resend."
      : "Verify the sending domain in Resend — nothing else matters until this is green.",
  });

  // 2. Sending history age — 20 pts (only counts once volume exists)
  const age =
    input.sent30 > 0 ? clamp01(input.historyDays / 60) * 20 : 0;
  factors.push({
    label: "Sending history",
    weight: 20,
    earned: Math.round(age * 10) / 10,
    note:
      input.sent30 === 0
        ? "No volume yet — history starts with the first sends."
        : input.historyDays < 14
          ? "Under 14 days — mailbox providers have little data on you yet."
          : input.historyDays < 60
            ? "Early history. Keep volume steady and engagement up."
            : "Established history.",
  });

  // 3. Volume consistency (last 14 days) — 15 pts
  const consistency =
    input.sent30 > 0 ? clamp01(input.activeDays14 / 14) * 15 : 0;
  factors.push({
    label: "Volume consistency",
    weight: 15,
    earned: Math.round(consistency * 10) / 10,
    note:
      input.sent30 === 0
        ? "No sends in the last 30 days."
        : `${input.activeDays14} of 14 days active. Gaps reset the ramp.`,
  });

  // 4. Bounce rate — 15 pts (no volume yet = no credit)
  const bounceRate = input.sent30 > 0 ? input.bounced30 / input.sent30 : 0;
  const bounce =
    input.sent30 === 0
      ? 0
      : bounceRate <= 0.02
        ? 15
        : bounceRate <= 0.05
          ? 10
          : bounceRate <= 0.1
            ? 5
            : 0;
  factors.push({
    label: "Bounce rate (30d)",
    weight: 15,
    earned: bounce,
    note:
      input.sent30 === 0
        ? "No sends to measure yet — volume is what builds this."
        : bounceRate <= 0.02
          ? "Under 2% — healthy."
          : bounceRate <= 0.05
            ? "2–5% — review list quality."
            : "Above 5% — hard bounces damage reputation fast.",
  });

  // 5. Complaint rate — 15 pts (no volume yet = no credit)
  const complaintRate = input.sent30 > 0 ? input.complained30 / input.sent30 : 0;
  const complaint =
    input.sent30 === 0
      ? 0
      : complaintRate <= 0.001
        ? 15
        : complaintRate <= 0.003
          ? 10
          : complaintRate <= 0.01
            ? 5
            : 0;
  factors.push({
    label: "Complaint rate (30d)",
    weight: 15,
    earned: complaint,
    note:
      input.sent30 === 0
        ? "No sends to measure yet — volume is what builds this."
        : complaintRate <= 0.001
          ? "No meaningful complaints."
          : complaintRate <= 0.003
            ? "0.1–0.3% — worth watching."
            : "Above 0.3% — spam-reporting hurts reputation fast.",
  });

  // 6. Engagement (unique open rate) — 10 pts
  const openRate = input.sent30 > 0 ? input.uniqueOpens30 / input.sent30 : 0;
  const engagement =
    !input.trackingEnabled || input.sent30 === 0
      ? 0
      : openRate >= 0.5
        ? 10
        : openRate >= 0.3
          ? 7
          : openRate >= 0.15
            ? 4
            : 0;
  factors.push({
    label: "Unique open rate (30d)",
    weight: 10,
    earned: engagement,
    note: !input.trackingEnabled
      ? "Open tracking is off on the Resend domain — enable it to see engagement."
      : input.sent30 === 0
        ? "No sends to measure yet — opens arrive with the first real volume."
        : openRate >= 0.3
          ? "Healthy engagement for cold outreach."
          : "Low opens — cold lists often land here; watch the trend, not the level.",
  });

  let score = factors.reduce((s, f) => s + f.earned, 0);

  // Penalty: volume spikes >3x the daily average look automated.
  // Capped at 59 so a spiked domain cannot present as "Warm".
  if (
    input.sent30 >= 10 &&
    input.avgDayVolume30 > 0 &&
    input.maxDayVolume30 > input.avgDayVolume30 * 3
  ) {
    score = Math.min(score, 59);
  }

  const state: WarmthState = score < 30 ? "Cold" : score < 60 ? "Warming" : score < 80 ? "Warm" : "Hot";

  return { score: Math.round(score), state, factors };
}

/** Recommended daily cold-outreach volume for a warmth state. */
export const RAMP_BY_STATE: Record<WarmthState, { daily: number; note: string }> = {
  Cold: { daily: 10, note: "Keep it under 10/day while records settle." },
  Warming: { daily: 30, note: "The cold-outreach ceiling — advance week by week." },
  Warm: { daily: 40, note: "Steady growth — watch bounce and complaints." },
  Hot: { daily: 50, note: "A comfortably warmed mailbox sustains this." },
};

export const RAMP_SCHEDULE = [
  { week: 1, daily: 10, condition: "Verify records; no campaigns yet" },
  { week: 2, daily: 20, condition: "Advance when bounce <3% and opens healthy" },
  { week: 3, daily: 30, condition: "Cold-outreach ceiling" },
  { week: 4, daily: 40, condition: "Advance only with no complaint spikes" },
  { week: 5, daily: 50, condition: "Comfortable ceiling for a warmed mailbox" },
] as const;
