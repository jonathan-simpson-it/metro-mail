"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { ThreadListItem, ReaderMessage } from "@/components/dashboard/thread-list";
import { ReplyDialog } from "@/components/dashboard/reply-dialog";
import { displayName, formatFullDate, formatRelativeTime, initials } from "@/lib/format";
import { site } from "@/lib/site";

/* ------------------------------------------------------------------ */
/* Sanitised iframe document. Brand base styles applied to raw HTML    */
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
    padding: 1rem 1.25rem;
    overflow-wrap: break-word;
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

      {/* Sanitised body */}
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
/* Attachment chips. Inbound links fetched lazily via API             */
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
  const [replyOpen, setReplyOpen] = useState(false);
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

  const replyDisabled =
    thread.participants.filter(
      (p) =>
        p.toLowerCase() !== userEmail.toLowerCase() &&
        !p.toLowerCase().endsWith(`@${site.mailDomain}`),
    ).length === 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-lg text-ink">{thread.subject}</h1>
          <p className="mt-0.5 font-mono text-[0.72rem] tracking-[0.05em] text-muted">
            {messages.length} MESSAGES · {thread.participants.length} PARTICIPANTS
          </p>
        </div>
        <button
          type="button"
          className="btn btn--solid btn--small shrink-0"
          disabled={replyDisabled}
          onClick={() => setReplyOpen(true)}
        >
          Reply
        </button>
      </div>

      <div className="flex-1 bg-cream">
        {messages.map((m) => (
          <MessageCard key={m.id} message={m} />
        ))}
      </div>

      <ReplyDialog
        open={replyOpen}
        thread={thread}
        userEmail={userEmail}
        lastMessageId={lastMessageId}
        onClose={() => setReplyOpen(false)}
      />
    </div>
  );
}
