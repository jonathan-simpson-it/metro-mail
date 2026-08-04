import { getResend } from "@/lib/resend";
import { processInboundEmail } from "@/lib/inbound";
import { connectToDatabase } from "@/lib/mongoose";
import { EmailEvent, type EmailEventType } from "@/models/EmailEvent";
import type { WebhookEventPayload } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

const TRACKED_TYPES: EmailEventType[] = [
  "sent",
  "delivered",
  "bounced",
  "opened",
  "clicked",
  "complained",
  "delivery_delayed",
];

/**
 * Resend webhook: inbound (`email.received`) plus delivery analytics
 * (`email.sent/delivered/bounced/opened/clicked/complained/delivery_delayed`).
 * Svix-signed (svix-id / svix-timestamp / svix-signature headers), verified
 * against the raw request body before any processing. Event persistence is
 * idempotent on the Resend event id.
 */
export async function POST(request: Request) {
  const payload = await request.text();

  if (!WEBHOOK_SECRET) {
    console.error("[webhook] RESEND_WEBHOOK_SECRET is not configured");
    return Response.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  let event: WebhookEventPayload;
  try {
    event = getResend().webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: WEBHOOK_SECRET,
    });
  } catch (err) {
    console.error("[webhook] signature verification failed:", err);
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type === "email.received") {
    if (!event.data?.email_id) {
      return Response.json({ ok: true, skipped: true });
    }
    try {
      const result = await processInboundEmail({
        email_id: event.data.email_id,
        from: event.data.from,
        to: event.data.to ?? [],
        subject: event.data.subject,
      });
      return Response.json({ ok: true, ...result });
    } catch (err) {
      console.error("[webhook] processing failed:", err);
      return Response.json(
        { error: "Processing failed" },
        { status: 500 },
      );
    }
  }

  // Delivery analytics. Persist idempotently. Resend events have no own id;
  // the Svix delivery id is unique per webhook attempt and covers retries.
  const type = event.type.replace("email.", "") as EmailEventType;
  const data = event.data as {
    email_id?: string;
    url?: string;
    user_agent?: string;
  } | null;
  const svixId = request.headers.get("svix-id");
  if (!TRACKED_TYPES.includes(type) || !svixId || !data?.email_id) {
    return Response.json({ ok: true, skipped: true });
  }

  try {
    await connectToDatabase();
    await EmailEvent.create({
      eventId: svixId,
      resendEmailId: data.email_id,
      type,
      url: typeof data.url === "string" ? data.url.slice(0, 2048) : undefined,
      userAgent:
        typeof data.user_agent === "string" ? data.user_agent.slice(0, 512) : undefined,
    });
    return Response.json({ ok: true });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      // Duplicate event delivery. Already recorded.
      return Response.json({ ok: true, duplicate: true });
    }
    // Transient failure (DB down etc.): return 500 so Svix retries.
    // svix-id makes retries idempotent, so nothing is double-recorded.
    console.error("[webhook] event persistence failed:", err);
    return Response.json(
      { error: "Event persistence failed" },
      { status: 500 },
    );
  }
}
