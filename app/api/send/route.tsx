import { headers } from "next/headers";
import { render } from "@react-email/render";
import mongoose from "mongoose";
import sanitizeHtml from "sanitize-html";
import { getAuth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongoose";
import { getResend } from "@/lib/resend";
import { MetroEmailLayout } from "@/emails/metro-layout";
import { Thread } from "@/models/Thread";
import { Message } from "@/models/Message";
import { buildReferences, normalizeSubject, snippetFromText } from "@/lib/threading";
import { EMAIL_LIMITS, EMAIL_RE, hasUnresolvedTokens, htmlToText, isValidEmailList } from "@/lib/email-text";
import { isOverDailySendLimit } from "@/lib/send-policy";
import {
  DEFAULT_SENDER_ALIAS,
  DEFAULT_SENDER_NAME,
  formatSenderAddress,
  resolveSenderAlias,
  sanitizeFromName,
  site,
  stripHeaderControl,
} from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SendAttachment {
  filename: string;
  content: string; // base64
  contentType?: string;
}

interface SendBody {
  to: string[];
  subject: string;
  html: string;
  fromName?: string;
  fromAlias?: string;
  cc?: string[];
  bcc?: string[];
  threadId?: string;
  inReplyToMessageId?: string;
  attachments?: SendAttachment[];
}

export async function POST(request: Request) {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray(body.to) ||
    !Array.isArray(body.cc ?? []) ||
    !Array.isArray(body.bcc ?? []) ||
    typeof body.subject !== "string" ||
    typeof body.html !== "string" ||
    !Array.isArray(body.attachments ?? []) ||
    typeof body.fromName !== "undefined" && typeof body.fromName !== "string" ||
    typeof body.fromAlias !== "undefined" && typeof body.fromAlias !== "string" ||
    !(body.to as unknown[]).every((e) => typeof e === "string") ||
    !(body.cc as unknown[]).every((e) => typeof e === "string") ||
    !(body.bcc as unknown[]).every((e) => typeof e === "string")
  ) {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }

  const to = body.to.map((e) => e.trim().toLowerCase()).filter(Boolean);
  const cc = (body.cc ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
  const bcc = (body.bcc ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
  const dedupedAll = [...new Set([...to, ...cc, ...bcc])];
  if (!isValidEmailList(to)) {
    return Response.json(
      { error: "Provide between 1 and 50 valid recipient addresses." },
      { status: 400 },
    );
  }
  if (
    dedupedAll.length > EMAIL_LIMITS.maxRecipients ||
    !dedupedAll.every((e) => EMAIL_RE.test(e))
  ) {
    return Response.json(
      { error: `Recipients across To, Cc and Bcc cannot exceed ${EMAIL_LIMITS.maxRecipients} valid addresses.` },
      { status: 400 },
    );
  }

  const subject = stripHeaderControl(body.subject?.trim() ?? "");
  if (!subject || subject.length > EMAIL_LIMITS.maxSubjectChars) {
    return Response.json(
      { error: `A subject line is required (max ${EMAIL_LIMITS.maxSubjectChars} characters).` },
      { status: 400 },
    );
  }

  const html = body.html?.trim();
  if (!html || Buffer.byteLength(html, "utf8") > EMAIL_LIMITS.maxHtmlBytes) {
    return Response.json(
      { error: "An HTML body is required (max 500 KB)." },
      { status: 400 },
    );
  }

  // --- Attachments validation
  const attachments: SendAttachment[] = body.attachments ?? [];
  let totalBytes = 0;
  for (const a of attachments) {
    if (
      !a ||
      typeof a !== "object" ||
      typeof a.filename !== "string" ||
      typeof a.content !== "string" ||
      !a.filename ||
      !a.content
    ) {
      return Response.json(
        { error: "Each attachment needs a filename and base64 content." },
        { status: 400 },
      );
    }
    const bytes = Math.floor((a.content.length * 3) / 4);
    if (!Number.isFinite(bytes) || bytes > EMAIL_LIMITS.maxAttachmentBytes) {
      return Response.json(
        { error: `Attachment "${a.filename}" exceeds the 6 MB limit.` },
        { status: 413 },
      );
    }
    totalBytes += bytes;
  }
  if (totalBytes > EMAIL_LIMITS.maxTotalAttachmentBytes) {
    return Response.json(
      { error: "Total attachment size exceeds the 18 MB limit." },
      { status: 413 },
    );
  }

  // --- Sender identity: explicit compose values → user settings → defaults
  // Header-injection-safe: CRLF/control chars stripped, alias validated.
  const user = session.user as typeof session.user & {
    fromName?: string;
    fromAlias?: string;
  };
  const fromName = sanitizeFromName(
    body.fromName?.trim() || user.fromName || DEFAULT_SENDER_NAME,
  );
  const rawAlias = body.fromAlias?.trim() || user.fromAlias || DEFAULT_SENDER_ALIAS;
  const fromAlias = resolveSenderAlias(rawAlias);
  if (fromName.length === 0) {
    return Response.json(
      { error: "Sender name contains unsupported characters." },
      { status: 400 },
    );
  }
  const from = `${fromName} <${formatSenderAddress(fromAlias)}>`;

  // --- Per-user daily send cap (Mongo-backed, survives restarts)
  if (await isOverDailySendLimit(formatSenderAddress(fromAlias))) {
    return Response.json(
      { error: `Daily send limit (${process.env.SEND_DAILY_LIMIT ?? 100}) reached.` },
      { status: 429 },
    );
  }

  // --- Threading headers (replies)
  let threadId: string | null = null;
  let threadingHeaders: Record<string, string> = {};

  if (body.threadId && body.inReplyToMessageId) {
    if (
      !mongoose.isValidObjectId(body.threadId) ||
      !mongoose.isValidObjectId(body.inReplyToMessageId)
    ) {
      return Response.json({ error: "Invalid thread reference." }, { status: 400 });
    }
    await connectToDatabase();
    const parent = await Message.findById(body.inReplyToMessageId)
      .select("messageId references threadId")
      .lean();
    if (parent && String(parent.threadId) === body.threadId) {
      threadId = body.threadId;
      const chain = buildReferences(parent.messageId, parent.references);
      threadingHeaders = {
        "In-Reply-To": parent.messageId ?? "",
        References: chain.join(" "),
      };
    }
  }

  // --- Render branded template (content sanitised server-side first)
  const safeHtml = sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "b", "strong", "i", "em", "u", "s", "strike", "a", "ul", "ol",
      "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "pre",
      "code", "table", "thead", "tbody", "tr", "th", "td", "img", "span", "div",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      span: ["style"],
      p: ["style"],
      div: ["style"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https", "http"] },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
  });

  // Defence-in-depth: never ship raw template tokens to recipients.
  if (hasUnresolvedTokens(safeHtml)) {
    return Response.json(
      { error: "Template tokens remain unreplaced ({{…}}). Replace or remove them before sending." },
      { status: 400 },
    );
  }

  if (!safeHtml.trim()) {
    return Response.json(
      { error: "The message body is empty after sanitisation. Write some content." },
      { status: 400 },
    );
  }

  const htmlWithLayout = await render(
    <MetroEmailLayout previewText={subject} contentHtml={safeHtml} />,
    { pretty: true },
  );

  const text = htmlToText(safeHtml);

  const { data, error } = await getResend().emails.send({
    from,
    to,
    cc: cc.length > 0 ? cc : undefined,
    bcc: bcc.length > 0 ? bcc : undefined,
    subject,
    html: htmlWithLayout,
    text,
    headers: threadingHeaders,
    attachments:
      attachments.length > 0
        ? attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            content_type: a.contentType ?? "application/octet-stream",
          }))
        : undefined,
  });

  if (error) {
    console.error("[send] delivery failed:", error.message);
    return Response.json(
      {
        error: "Message could not be delivered.",
        details: error.message ?? "Unknown Resend error",
      },
      { status: 500 },
    );
  }

  // --- Persist + touch thread (non-fatal on failure)
  try {
    await connectToDatabase();

    const snippet = snippetFromText(text, 200);

    let savedThreadId: string;
    if (threadId) {
      savedThreadId = threadId;
    } else {
      const normalized = normalizeSubject(subject);
      const existingThread = await Thread.findOne({
        normalizedSubject: normalized,
        participants: { $in: [user.email, ...dedupedAll] },
      }).lean();
      savedThreadId = existingThread
        ? String(existingThread._id)
        : (
            await Thread.create({
              subject,
              normalizedSubject: normalized,
              participants: [user.email, ...dedupedAll],
              snippet: "",
              lastMessageAt: new Date(),
              messageCount: 0,
            })
          )._id.toString();
    }

    const messageId = `<${data?.id}@${site.mailDomain}>`;
    const senderAddress = formatSenderAddress(fromAlias);

    await Message.create({
      threadId: savedThreadId,
      resendEmailId: data?.id,
      messageId,
      inReplyTo: threadingHeaders["In-Reply-To"],
      references: threadingHeaders.References
        ? threadingHeaders.References.split(/\s+/)
        : [],
      sender: { name: fromName, email: senderAddress },
      recipients: to,
      cc,
      bcc,
      subject,
      htmlBody: htmlWithLayout,
      textBody: text,
      direction: "outbound",
      attachments: attachments.map((a) => ({
        filename: a.filename,
        contentType: a.contentType ?? "application/octet-stream",
      })),
    });

    await Thread.updateOne(
      { _id: savedThreadId },
      {
        $set: { snippet, lastMessageAt: new Date() },
        $addToSet: { participants: { $each: [user.email, ...dedupedAll] } },
        $inc: { messageCount: 1 },
      },
    );

    return Response.json({ id: data?.id, threadId: savedThreadId });
  } catch (err) {
    console.error("[send] persistence failed after delivery:", err);
    return Response.json({ id: data?.id });
  }
}
