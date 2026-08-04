import { connectToDatabase } from "@/lib/mongoose";
import { Message } from "@/models/Message";
import { EmailEvent } from "@/models/EmailEvent";
import { getResend } from "@/lib/resend";
import { computeWarmth, type WarmthResult } from "@/lib/warmth";
import { site } from "@/lib/site";

const DAY = 24 * 60 * 60 * 1000;

export interface DomainHealth {
  name: string;
  status: string;
  records: { type: string; name: string; value: string; status: string }[];
  openTracking: boolean;
  clickTracking: boolean;
  trackingSubdomain: string | null;
}

export interface DeliverabilityData {
  domain: DomainHealth | null;
  stats: {
    sent30: number;
    delivered30: number;
    bounced30: number;
    uniqueOpens30: number;
    uniqueClicks30: number;
    complained30: number;
    replies30: number;
    openRate: number | null;
    clickRate: number | null;
    bounceRate: number | null;
    complaintRate: number | null;
    replyRate: number | null;
  };
  dailyVolume: { date: string; count: number }[];
  warmth: WarmthResult;
  trackingEnabled: boolean;
  recentEvents: {
    resendEmailId: string;
    type: string;
    createdAt: Date;
    url: string | null;
    subject: string | null;
  }[];
}

async function getDomainHealth(): Promise<DomainHealth | null> {
  try {
    const { data: list, error } = await getResend().domains.list();
    const domains = list?.data ?? [];
    if (error || domains.length === 0) return null;
    const domain = domains.find((d) => d.name === site.mailDomain) ?? domains[0];
    const detail = await getResend().domains.get(domain.id);
    const d = detail.data;
    if (!d) return null;
    return {
      name: domain.name,
      status: domain.status ?? "unknown",
      records: (d.records ?? []).map((r) => ({
        type: r.type ?? "record",
        name: r.name ?? "",
        value: r.value ?? "",
        status: r.status ?? "pending",
      })),
      openTracking: Boolean(d.open_tracking),
      clickTracking: Boolean(d.click_tracking),
      trackingSubdomain: d.tracking_subdomain ?? null,
    };
  } catch (err) {
    console.error("[deliverability] domain lookup failed:", err);
    return null;
  }
}

export async function getDeliverabilityData(): Promise<DeliverabilityData> {
  await connectToDatabase();

  const since30 = new Date(Date.now() - 30 * DAY);
  const since14 = new Date(Date.now() - 14 * DAY);

  const [sent30, events30, firstMessage, activeDays, dailyVolume, recentEvents, domain] =
    await Promise.all([
      Message.countDocuments({ direction: "outbound", createdAt: { $gte: since30 } }),
      EmailEvent.find({ createdAt: { $gte: since30 } }).select("resendEmailId type url").lean(),
      Message.findOne({ direction: "outbound" }).sort({ createdAt: 1 }).select("createdAt").lean(),
      // Distinct days with at least one outbound send in the last 14 days.
      Message.aggregate<{ _id: string }>([
        { $match: { direction: "outbound", createdAt: { $gte: since14 } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          },
        },
      ]).then((days) => days.length),
      Message.aggregate<{ _id: string; count: number }>([
        { $match: { direction: "outbound", createdAt: { $gte: since30 } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      EmailEvent.find().sort({ createdAt: -1 }).limit(25).lean(),
      getDomainHealth(),
    ]);

  // Reply rate: inbound messages landing in threads that contain an
  // outbound send from us, within the last 30 days.
  const outboundThreads = await Message.distinct("threadId", {
    direction: "outbound",
    createdAt: { $gte: since30 },
  });
  const replies30 = await Message.countDocuments({
    direction: "inbound",
    threadId: { $in: outboundThreads },
    createdAt: { $gte: since30 },
  });

  const typeCount = (type: string) =>
    events30.filter((e) => e.type === type).length;
  const uniqueByType = (type: string) =>
    new Set(events30.filter((e) => e.type === type).map((e) => e.resendEmailId)).size;

  const bounced = uniqueByType("bounced");
  const complained = uniqueByType("complained");
  const uniqueOpens = uniqueByType("opened");
  const uniqueClicks = uniqueByType("clicked");

  const rate = (n: number) => (sent30 > 0 ? n / sent30 : null);

  const historyDays = firstMessage
    ? Math.max(0, Math.floor((Date.now() - new Date(firstMessage.createdAt).getTime()) / DAY))
    : 0;

  const dailyCounts = dailyVolume.map((d) => d.count);
  const maxDay = dailyCounts.length > 0 ? Math.max(...dailyCounts) : 0;
  const avgDay =
    dailyCounts.length > 0 ? dailyCounts.reduce((s, c) => s + c, 0) / dailyCounts.length : 0;

  // Resend's own verdict on the domain is the authoritative record gate —
  // its records list covers SPF/DKIM/MX but not DMARC, so per-record checks
  // would be misleading.
  const recordsVerified = domain?.status === "verified";
  const trackingEnabled = domain ? domain.openTracking || domain.clickTracking : false;

  const warmth = computeWarmth({
    recordsVerified,
    historyDays,
    activeDays14: activeDays,
    sent30,
    bounced30: bounced,
    complained30: complained,
    uniqueOpens30: uniqueOpens,
    maxDayVolume30: maxDay,
    avgDayVolume30: avgDay,
    trackingEnabled,
  });

  const eventEmailIds = recentEvents.map((e) => e.resendEmailId);
  const subjects = await Message.find({ resendEmailId: { $in: eventEmailIds } })
    .select("resendEmailId subject")
    .lean();
  const subjectMap = new Map(subjects.map((m) => [m.resendEmailId, m.subject]));

  return {
    domain,
    stats: {
      sent30,
      delivered30: typeCount("delivered"),
      bounced30: bounced,
      uniqueOpens30: uniqueOpens,
      uniqueClicks30: uniqueClicks,
      complained30: complained,
      replies30,
      openRate: rate(uniqueOpens),
      clickRate: rate(uniqueClicks),
      bounceRate: rate(bounced),
      complaintRate: rate(complained),
      replyRate: rate(replies30),
    },
    dailyVolume: dailyVolume.map((d) => ({ date: d._id, count: d.count })),
    warmth,
    trackingEnabled,
    recentEvents: recentEvents.map((e) => ({
      resendEmailId: e.resendEmailId,
      type: e.type,
      createdAt: e.createdAt,
      url: e.url ?? null,
      subject: subjectMap.get(e.resendEmailId) ?? null,
    })),
  };
}
