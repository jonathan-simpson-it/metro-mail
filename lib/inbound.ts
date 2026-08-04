import { connectToDatabase } from "@/lib/mongoose";
import { getResend } from "@/lib/resend";
import { Thread } from "@/models/Thread";
import { Message } from "@/models/Message";
import { RoutingRule } from "@/models/RoutingRule";
import {
  getHeader,
  normalizeSubject,
  parseReferences,
  snippetFromText,
} from "@/lib/threading";
import { site, DEFAULT_SENDER_ALIAS, stripHeaderControl } from "@/lib/site";

export interface InboundEventData {
  email_id: string;
  from: string;
  to: string[];
  subject?: string;
}

/** "Name <email>" → { name, email } */
export function parseAddress(raw: string): { name?: string; email: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(?:(.*?)\s*)?<([^<>\s]+@[^<>\s]+)>$/);
  if (match) {
    return { name: match[1]?.trim() || undefined, email: match[2] };
  }
  return { email: trimmed };
}

function localPart(address: string): string {
  return address.trim().toLowerCase().split("@")[0];
}

/**
 * Resolves forwarding destinations for an inbound message:
 * per-alias RoutingRule match (local part or full address), then `*` catch-all,
 * then the FALLBACK_FORWARD_TO env, then nothing.
 */
async function resolveForwardDestinations(
  toAddresses: string[],
  senderEmail: string,
): Promise<string[]> {
  const rules = await RoutingRule.find({ active: true }).lean();

  const destinations = new Set<string>();
  for (const address of toAddresses) {
    const local = localPart(address);
    const full = address.trim().toLowerCase();
    const match = rules.find(
      (r) =>
        r.alias.trim().toLowerCase() === local ||
        r.alias.trim().toLowerCase() === full,
    );
    if (match) {
      match.forwardTo.forEach((d) => destinations.add(d.trim().toLowerCase()));
    }
  }

  // Catch-all fallback
  const catchAll = rules.find((r) => r.alias.trim() === "*");
  if (destinations.size === 0 && catchAll) {
    catchAll.forwardTo.forEach((d) => destinations.add(d.trim().toLowerCase()));
  }

  // Env fallback
  if (destinations.size === 0 && process.env.FALLBACK_FORWARD_TO) {
    process.env.FALLBACK_FORWARD_TO.split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
      .forEach((d) => destinations.add(d));
  }

  // Loop protection: never forward back to the sender, never forward into
  // our own receiving domain (would re-enter the webhook and loop forever).
  destinations.delete(senderEmail.trim().toLowerCase());
  for (const dest of [...destinations]) {
    if (dest.endsWith(`@${site.mailDomain}`)) {
      destinations.delete(dest);
    }
  }

  return [...destinations];
}

/**
 * Full inbound pipeline: hydrate → thread → persist → forward.
 * Idempotent per Resend `email_id`.
 */
export async function processInboundEmail(eventData: InboundEventData) {
  await connectToDatabase();
  const resend = getResend();

  const { email_id: emailId } = eventData;

  // Idempotency. Resend retries webhooks; skip already-persisted emails.
  const existing = await Message.findOne({ resendEmailId: emailId }).lean();
  if (existing) return { persisted: false, forwarded: [] };

  const { data: email, error } = await resend.emails.receiving.get(emailId);
  if (error || !email) {
    throw new Error(
      `Failed to hydrate email ${emailId}: ${error?.message ?? "no data"}`,
    );
  }

  const sender = parseAddress(email.from ?? eventData.from ?? "");
  const receivedFor = (email.received_for ?? []).filter(Boolean);
  const recipients = (receivedFor.length > 0 ? receivedFor : email.to ?? eventData.to ?? []).filter(Boolean);
  const subject = email.subject ?? eventData.subject ?? "(no subject)";

  // Sanitise attacker-controlled headers. They later flow into outbound
  // In-Reply-To/References and must never carry CRLF.
  const messageId = stripHeaderControl(
    email.message_id ?? getHeader(email.headers, "message-id") ?? `<${emailId}@${site.mailDomain}>`,
  );
  const inReplyTo = stripHeaderControl(getHeader(email.headers, "in-reply-to") ?? "");
  const references = parseReferences(
    stripHeaderControl(getHeader(email.headers, "references") ?? ""),
  );

  // --- Thread resolution: References chain → normalised subject match → new thread
  let threadId: string;

  const refIds = [...(inReplyTo ? [inReplyTo] : []), ...references];
  if (refIds.length > 0) {
    const parent = await Message.findOne({ messageId: { $in: refIds } })
      .select("threadId subject")
      .lean();
    if (parent) {
      threadId = String(parent.threadId);
    } else {
      const threadByRef = await Thread.findOne({
        normalizedSubject: normalizeSubject(subject),
        participants: { $in: [sender.email] },
      }).lean();
      threadId = threadByRef
        ? String(threadByRef._id)
        : (
            await Thread.create({
              subject,
              normalizedSubject: normalizeSubject(subject),
              participants: [sender.email, ...recipients],
              snippet: "",
              lastMessageAt: new Date(),
              messageCount: 0,
            })
          )._id.toString();
    }
  } else {
    const threadBySubject = await Thread.findOne({
      normalizedSubject: normalizeSubject(subject),
      participants: { $in: [sender.email] },
    }).lean();
    threadId = threadBySubject
      ? String(threadBySubject._id)
      : (
          await Thread.create({
            subject,
            normalizedSubject: normalizeSubject(subject),
            participants: [sender.email, ...recipients],
            snippet: "",
            lastMessageAt: new Date(),
            messageCount: 0,
          })
        )._id.toString();
  }

  const textBody = email.text ?? "";
  const snippet = snippetFromText(textBody, 200);

  const attachments = (email.attachments ?? []).map((a) => ({
    id: a.id,
    filename: a.filename ?? "attachment",
    contentType: a.content_type,
    contentDisposition: a.content_disposition ?? undefined,
    contentId: a.content_id ?? undefined,
    size: a.size,
  }));

  try {
    await Message.create({
      threadId,
      resendEmailId: emailId,
      messageId,
      inReplyTo: inReplyTo || undefined,
      references,
      sender,
      recipients,
      subject,
      htmlBody: email.html ?? "",
      textBody,
      direction: "inbound",
      attachments,
    });
  } catch (err) {
    // Concurrent webhook delivery. A duplicate key on resendEmailId means a
    // sibling request already persisted this email. Not an error.
    const code = (err as { code?: number })?.code;
    if (code === 11000) {
      return { persisted: false, forwarded: [] };
    }
    throw err;
  }

  await Thread.updateOne(
    { _id: threadId },
    {
      $set: { snippet, lastMessageAt: new Date() },
      $addToSet: { participants: { $each: [sender.email, ...recipients] } },
      $inc: { messageCount: 1 },
    },
  );

  // --- Forwarding (fail-open: persistence already succeeded)
  let forwarded: string[] = [];
  try {
    const destinations = await resolveForwardDestinations(recipients, sender.email);
    if (destinations.length > 0) {
      const { error: forwardError } = await resend.emails.receiving.forward({
        emailId,
        to: destinations,
        from: `${DEFAULT_SENDER_ALIAS}@${site.mailDomain}`,
      });
      if (forwardError) {
        console.error(`[inbound] forward failed for ${emailId}:`, forwardError.message);
      } else {
        forwarded = destinations;
      }
    }
  } catch (err) {
    console.error(`[inbound] forward error for ${emailId}:`, err);
  }

  return { persisted: true, forwarded };
}
