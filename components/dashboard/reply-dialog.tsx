"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { site } from "@/lib/site";
import { hasUnresolvedTokens } from "@/lib/email-text";
import type { ThreadListItem } from "@/components/dashboard/thread-list";

export function ReplyDialog({
  open,
  thread,
  userEmail,
  lastMessageId,
  onClose,
}: {
  open: boolean;
  thread: ThreadListItem;
  userEmail: string;
  lastMessageId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setError(null);
      setSent(false);
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  const recipients = thread.participants.filter(
    (p) =>
      p.toLowerCase() !== userEmail.toLowerCase() &&
      !p.toLowerCase().endsWith(`@${site.mailDomain}`),
  );

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);

    const html = text
      .split(/\n{2,}/)
      .map(
        (p) =>
          `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
      )
      .join("\n");

    try {
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
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        details?: string;
      } | null;

      if (!res.ok || data?.error) {
        setError(
          data?.details
            ? `${data.error} (${data.details})`
            : (data?.error ?? "Reply failed to send."),
        );
        return;
      }

      setBody("");
      setSent(true);
      onClose();
      router.refresh();
    } catch {
      setError("Reply failed to send. Check your connection.");
    } finally {
      setSending(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="send-guard"
      aria-labelledby="reply-dialog-title"
      onClose={onClose}
    >
      <form onSubmit={sendReply} className="flex w-full max-w-[34rem] flex-col p-6">
        <p className="eyebrow mb-2">Reply</p>
        <h2 id="reply-dialog-title" className="font-serif text-xl text-ink">
          Re: {thread.subject}
        </h2>
        <p className="mt-2 truncate font-mono text-[0.72rem] text-muted">
          To: {recipients.length > 0 ? recipients.join(", ") : "-"}
        </p>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          autoFocus
          placeholder="Write your reply…"
          className="input mt-4 !rounded-md text-sm"
        />
        {hasUnresolvedTokens(body) ? (
          <p className="mt-1 text-xs text-ink" role="alert">
            Template tokens are not supported in replies.
          </p>
        ) : null}
        {error ? (
          <p className="mt-1 text-xs text-ink" role="alert">
            {error}
          </p>
        ) : null}
        {sent ? (
          <p className="mt-1 font-mono text-[0.72rem] tracking-[0.1em] text-sage-text">
            DELIVERED
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--solid"
            disabled={sending || !body.trim()}
          >
            {sending ? "Sending…" : "Send reply"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
