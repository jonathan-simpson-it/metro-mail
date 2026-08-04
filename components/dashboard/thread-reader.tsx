"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import { ThreadListItem, ReaderMessage } from "@/components/dashboard/thread-list";
import { displayName, formatFullDate, formatRelativeTime, initials } from "@/lib/format";
import { site } from "@/lib/site";

/* ------------------------------------------------------------------ */
/* Sanitized iframe document — brand base styles applied to raw HTML    */
/* ------------------------------------------------------------------ */

function buildSanitizedDocument(rawHtml: string): string {
  const clean = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target"],
  });

  // Never let inbound links hijack the reader frame or leak the opener.
  const doc = new DOMParser().parseFromString(clean, "text/html");
  doc.querySelectorAll("a").forEach((node) => {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  });
  const hardened = doc.body.innerHTML;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body {
    font-family: Inter, Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.65;
    color: #161714;
    background: #ffffff;
    margin: 0;
    padding: 0;
    overflow-wrap: break-word;
    max-width: 44rem;
    margin: 0 auto;
    padding: 0 1rem;
  }
  a { color: #5f7067; }
  img { max-width: 100%; height: auto; }
  blockquote {
    margin: 12px 0;
    padding: 4px 14px;
    border-left: 3px solid #d6d8d1;
    color: #5c5e56;
  }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #d6d8d1; padding: 6px 10px; }
  pre { white-space: pre-wrap; background: #f4f4ef; padding: 12px; }
  hr { border: none; border-top: 1px solid #d6d8d1; margin: 18px 0; }
</style>
</head>
<body>${hardened}</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Message card                                                        */
/* ------------------------------------------------------------------ */

function MessageCard({ message }: { message: ReaderMessage }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(240);

  const srcDoc = useMemo(
    () => buildSanitizedDocument(message.htmlBody || `<p>${message.textBody || ""}</p>`),
    [message.htmlBody, message.textBody],
  );

  const onLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    const height = doc?.body?.scrollHeight;
    if (height && height > 40) setIframeHeight(height + 16);
  }, []);

  const isOutbound = message.direction === "outbound";
  const senderDisplay = displayName(message.sender);

  return (
    <article className="border-b border-line bg-paper">
      {/* Meta row */}
      <header className="flex items-center gap-3 px-5 pt-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sage-soft font-mono text-[0.7rem] tracking-wider text-ink">
          {initials(senderDisplay)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {senderDisplay}
            {isOutbound && (
              <span className="ml-2 font-mono text-[0.72rem] tracking-[0.1em] text-sage-text">
                SENT
              </span>
            )}
          </p>
          <p className="truncate font-mono text-[0.72rem] text-muted">
            {message.sender.email}
          </p>
        </div>
        <time
          className="font-mono text-[0.72rem] text-muted"
          title={formatFullDate(message.createdAt)}
        >
          {formatRelativeTime(message.createdAt)}
        </time>
      </header>

      {/* Sanitized body */}
      <div className="px-5 py-3">
        <iframe
          ref={iframeRef}
          title={`Email body from ${senderDisplay}`}
          sandbox="allow-popups"
          srcDoc={srcDoc}
          onLoad={onLoad}
          style={{ height: iframeHeight, width: "100%", border: "none" }}
          className="block"
        />
      </div>

      {/* Attachments */}
      {message.attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-5 pb-4">
          <AttachmentChips message={message} />
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Attachment chips — inbound links fetched lazily via API             */
/* ------------------------------------------------------------------ */

function AttachmentChips({ message }: { message: ReaderMessage }) {
  const [links, setLinks] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (message.direction !== "inbound" || message.attachments.length === 0) return;
    let cancelled = false;
    fetch(`/api/attachments?messageId=${encodeURIComponent(message.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { attachments: { filename: string; downloadUrl: string }[] } | null) => {
        if (cancelled || !data) return;
        const map: Record<string, string> = {};
        data.attachments.forEach((a) => {
          map[a.filename] = a.downloadUrl;
        });
        setLinks(map);
      })
      .catch(() => setLinks({}));
    return () => {
      cancelled = true;
    };
  }, [message.id, message.direction, message.attachments.length]);

  return (
    <>
      {message.attachments.map((a) => {
        const url = links?.[a.filename];
        const inner = (
          <>
            <span aria-hidden>📎</span>
            <span className="max-w-[180px] truncate">{a.filename}</span>
          </>
        );
        return url ? (
          <a
            key={`${a.filename}-${message.id}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="chip hover:border-sage"
          >
            {inner}
          </a>
        ) : (
          <span key={`${a.filename}-${message.id}`} className="chip opacity-70" title={url === null ? "Attachment content unavailable" : undefined}>
            {inner}
          </span>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Reply box                                                           */
/* ------------------------------------------------------------------ */

function ReplyBox({
  thread,
  userEmail,
  lastMessageId,
}: {
  thread: ThreadListItem;
  userEmail: string;
  lastMessageId: string | null;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    setSent(false);

    const html = text
      .split(/\n{2,}/)
      .map(
        (p) =>
          `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
      )
      .join("\n");

    // Never reply to our own aliases — that would echo back through the
    // inbound webhook and duplicate the message in the thread.
    const recipients = thread.participants.filter(
      (p) =>
        p.toLowerCase() !== userEmail.toLowerCase() &&
        !p.toLowerCase().endsWith(`@${site.mailDomain}`),
    );

    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: recipients,
        subject: /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`,
        html,
        text,
        threadId: thread.id,
        inReplyToMessageId: lastMessageId ?? undefined,
      }),
    });

    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setSending(false);

    if (!res.ok || data?.error) {
      setError(data?.error ?? "Reply failed to send.");
      return;
    }

    setBody("");
    setSent(true);
    router.refresh();
    setTimeout(() => setSent(false), 4000);
  }

  return (
    <form onSubmit={sendReply} className="border-t border-line bg-paper p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted">
          Reply as <span className="text-sage-text">{userEmail}</span>
        </p>
        <span className="min-w-0 truncate font-mono text-[0.72rem] text-muted">
          Re: {thread.subject}
        </span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Write your reply…"
        className="input !rounded-md text-sm"
      />
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" className="btn btn--solid btn--small" disabled={sending || !body.trim()}>
          {sending ? "Sending…" : "Send reply"}
        </button>
        {error ? <p className="text-xs text-ink">{error}</p> : null}
        {sent ? <p className="font-mono text-[0.72rem] tracking-[0.1em] text-sage-text">DELIVERED</p> : null}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Thread reader                                                       */
/* ------------------------------------------------------------------ */

export function ThreadReader({
  thread,
  messages,
  userEmail,
}: {
  thread: ThreadListItem;
  messages: ReaderMessage[];
  userEmail: string;
}) {
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-lg text-ink">{thread.subject}</h1>
          <p className="mt-0.5 font-mono text-[0.72rem] tracking-[0.05em] text-muted">
            {messages.length} MESSAGES · {thread.participants.length} PARTICIPANTS
          </p>
        </div>
      </div>

      <div className="flex-1 bg-cream">
        {messages.map((m) => (
          <MessageCard key={m.id} message={m} />
        ))}
      </div>

      <ReplyBox thread={thread} userEmail={userEmail} lastMessageId={lastMessageId} />
    </div>
  );
}
