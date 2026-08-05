"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PaperPlaneTilt, X } from "@phosphor-icons/react";
import { formatSenderAddress, site } from "@/lib/site";
import { EMAIL_RE, hasUnresolvedTokens } from "@/lib/email-text";
import type { ThreadListItem } from "@/components/dashboard/thread-list";

type RecipientField = "to" | "cc";

function RecipientRow({
  field,
  label,
  list,
  value,
  showCcLink,
  onValueChange,
  onAdd,
  onRemove,
  onShowCc,
}: {
  field: RecipientField;
  label: string;
  list: string[];
  value: string;
  showCcLink: boolean;
  onValueChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (email: string) => void;
  onShowCc: () => void;
}) {
  return (
    <div className="flex items-start gap-4 py-3">
      <div className="flex w-20 shrink-0 flex-col pt-1.5">
        <label className="field-label mb-0" htmlFor={`reply-${field}`}>
          {label}
        </label>
        {field === "to" && showCcLink ? (
          <button type="button" className="field-add mt-1.5 w-max" onClick={onShowCc}>
            Cc
          </button>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        {list.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {list.map((email) => (
              <span key={email} className="chip">
                {email}
                <button
                  type="button"
                  onClick={() => onRemove(email)}
                  className="text-muted hover:text-ink"
                  aria-label={`Remove ${email}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <input
          id={`reply-${field}`}
          className="input !rounded-md !py-2 text-sm"
          placeholder={
            field === "to"
              ? "name@example.com (comma or enter to add)"
              : "cc@example.com (comma or enter to add)"
          }
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              onAdd();
            }
          }}
          onBlur={() => value.trim() && onAdd()}
        />
      </div>
    </div>
  );
}

export function ReplyDialog({
  open,
  thread,
  userEmail,
  defaultFromName,
  defaultFromAlias,
  lastMessageId,
  onClose,
}: {
  open: boolean;
  thread: ThreadListItem;
  userEmail: string;
  defaultFromName: string;
  defaultFromAlias: string;
  lastMessageId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [body, setBody] = useState("");
  const [toList, setToList] = useState<string[]>([]);
  const [ccList, setCcList] = useState<string[]>([]);
  const [inputs, setInputs] = useState<Record<RecipientField, string>>({ to: "", cc: "" });
  const [showCc, setShowCc] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill recipients each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    void (async () => {
      await Promise.resolve();
      const initial = thread.participants.filter(
        (p) =>
          p.toLowerCase() !== userEmail.toLowerCase() &&
          !p.toLowerCase().endsWith(`@${site.mailDomain}`),
      );
      setToList(initial);
      setCcList([]);
      setInputs({ to: "", cc: "" });
      setShowCc(false);
      setError(null);
    })();
  }, [open, thread.id, thread.participants, userEmail]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  function addRecipients(field: RecipientField, raw: string) {
    const parsed = raw
      .split(/[;,\n]/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const valid = parsed.filter((e) => EMAIL_RE.test(e));
    const bad = parsed.filter((e) => !EMAIL_RE.test(e));
    if (field === "to") {
      setToList((prev) => [...new Set([...prev, ...valid])]);
    } else {
      setCcList((prev) => [...new Set([...prev, ...valid])]);
    }
    setInputs((prev) => ({ ...prev, [field]: "" }));
    setError(bad.length > 0 ? `Ignored invalid address(es): ${bad.join(", ")}` : null);
  }

  function removeRecipient(field: RecipientField, email: string) {
    if (field === "to") setToList((prev) => prev.filter((e) => e !== email));
    else setCcList((prev) => prev.filter((e) => e !== email));
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    if (toList.length === 0) {
      setError("Add at least one recipient.");
      return;
    }

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
          to: toList,
          cc: ccList,
          subject: /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`,
          html,
          text,
          fromName: defaultFromName,
          fromAlias: defaultFromAlias,
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

      onClose();
      router.refresh();
    } catch {
      setError("Reply failed to send. Check your connection.");
    } finally {
      setSending(false);
    }
  }

  function recipientRowProps(field: RecipientField, label: string) {
    return {
      field,
      label,
      list: field === "to" ? toList : ccList,
      value: inputs[field],
      showCcLink: field === "to" && !showCc,
      onValueChange: (v: string) => setInputs((prev) => ({ ...prev, [field]: v })),
      onAdd: () => addRecipients(field, inputs[field]),
      onRemove: (email: string) => removeRecipient(field, email),
      onShowCc: () => setShowCc(true),
    } as const;
  }

  return (
    <dialog
      ref={ref}
      className="send-guard !max-w-[52rem]"
      aria-labelledby="reply-dialog-title"
      onClose={onClose}
    >
      <form onSubmit={sendReply} className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <p className="eyebrow mb-1">Reply</p>
            <h2
              id="reply-dialog-title"
              className="truncate font-serif text-lg text-ink"
            >
              Re: {thread.subject}
            </h2>
          </div>
          <button
            type="button"
            className="tool-btn shrink-0"
            onClick={onClose}
            aria-label="Close reply dialog"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex min-h-0 flex-col overflow-y-auto px-6">
          {/* From */}
          <div className="flex items-center gap-4 border-b border-line py-3">
            <span className="field-label mb-0 w-20 shrink-0 pt-1">From</span>
            <span className="min-w-0 truncate font-mono text-[0.66rem] text-muted">
              {defaultFromName} &lt;{formatSenderAddress(defaultFromAlias)}&gt;
            </span>
          </div>

          {/* To / Cc */}
          <div className="border-b border-line">
            <RecipientRow {...recipientRowProps("to", "To")} />
            {showCc ? (
              <div className="border-t border-line">
                <RecipientRow {...recipientRowProps("cc", "Cc")} />
              </div>
            ) : null}
          </div>

          {/* Subject */}
          <div className="flex items-center gap-4 border-b border-line py-3">
            <span className="field-label mb-0 w-20 shrink-0 pt-1">Subject</span>
            <span className="min-w-0 truncate text-sm text-ink">
              {/^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`}
            </span>
          </div>

          {/* Body */}
          <div className="py-3">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              autoFocus
              placeholder="Write your reply…"
              className="input !rounded-md text-sm"
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
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 border-t border-line bg-cream/50 px-6 py-4">
          <button
            type="submit"
            className="btn btn--solid"
            disabled={sending || !body.trim()}
          >
            <PaperPlaneTilt size={13} weight="bold" />
            {sending ? "Sending…" : "Send reply"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <span className="ml-auto hidden font-mono text-[0.66rem] text-muted md:inline">
            {toList.length} recipient(s)
          </span>
        </div>
      </form>
    </dialog>
  );
}
