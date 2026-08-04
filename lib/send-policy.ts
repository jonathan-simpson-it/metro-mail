import { connectToDatabase } from "@/lib/mongoose";
import { Message } from "@/models/Message";

function parseLimit(raw: string | undefined, fallback: number): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) {
    if (raw !== undefined && raw !== "") {
      console.error(
        `[send-policy] invalid limit "${raw}" — falling back to ${fallback}`,
      );
    }
    return fallback;
  }
  return n;
}

const SEND_DAILY_LIMIT = parseLimit(process.env.SEND_DAILY_LIMIT, 100);
const SEND_COLD_CEILING = parseLimit(process.env.SEND_COLD_CEILING, 30);

export interface DailySendStats {
  sentToday: number;
  dailyLimit: number;
  coldCeiling: number;
}

/**
 * Per-sender daily outbound cap (Mongo-backed, survives restarts).
 * Throws nothing — returns true when the sender is over the limit.
 */
export async function isOverDailySendLimit(senderAddress: string): Promise<boolean> {
  try {
    await connectToDatabase();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentToday = await Message.countDocuments({
      direction: "outbound",
      "sender.email": senderAddress,
      createdAt: { $gte: since },
    });
    return sentToday >= SEND_DAILY_LIMIT;
  } catch (err) {
    console.error("[send] rate-limit check failed (proceeding):", err);
    return false;
  }
}

/**
 * Daily send volume for a sender address, plus the configured limits.
 * Used by the compose send guard and the campaign quota indicator.
 * Throws nothing — degrades to zero volume so sending is never blocked
 * by an analytics failure (the hard wall lives in isOverDailySendLimit).
 */
export async function getDailySendStats(senderAddress: string): Promise<DailySendStats> {
  try {
    await connectToDatabase();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentToday = await Message.countDocuments({
      direction: "outbound",
      "sender.email": senderAddress,
      createdAt: { $gte: since },
    });
    return { sentToday, dailyLimit: SEND_DAILY_LIMIT, coldCeiling: SEND_COLD_CEILING };
  } catch (err) {
    console.error("[send] quota check failed (degrading):", err);
    return { sentToday: 0, dailyLimit: SEND_DAILY_LIMIT, coldCeiling: SEND_COLD_CEILING };
  }
}
