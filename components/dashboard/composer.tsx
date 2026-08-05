"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, FileText, Paperclip, PaperPlaneTilt } from "@phosphor-icons/react";
import { formatSenderAddress, site } from "@/lib/site";
import { EMAIL_LIMITS, EMAIL_RE, hasUnresolvedTokens } from "@/lib/email-text";
import { highlightTokens } from "@/lib/personalize";
import { RichEditor, type RichEditorHandle } from "./rich-editor";
import { SendGuardDialog } from "./send-guard-dialog";

interface TemplateSummary {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  html: string;
  tokens: string[];
}

interface ComposerAttachment {
  id: string;
  filename: string;
  contentType: string;
  content: string; // base64
  size: number;
}

type RecipientField = "to" | "cc" | "bcc";

const RECIPIENT_PLACEHOLDER: Record<RecipientField, string> = {
  to: "name@example.com (comma or enter to add)",
  cc: "cc@example.com (comma or enter to add)",
  bcc: "bcc@example.com (comma or enter to add)",
};

function RecipientRow({
  label,
  list,
  value,
  onChange,
  onAdd,
  onRemove,
  field,
  addLinks,
}: {
  label: string;
  list: string[];
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (email: string) => void;
  field: RecipientField;
  addLinks?: { label: string; onClick: () => void }[];
}) {
  return (
    <div className="flex items-start gap-4 py-3.5">
      <div className="flex w-20 shrink-0 flex-col pt-1.5">
        <label className="field-label mb-0" htmlFor={`compose-${field}`}>
          {label}
        </label>
        {addLinks && addLinks.length > 0 ? (
          <div className="mt-1.5 flex gap-2.5">
            {addLinks.map((link) => (
              <button
                key={link.label}
                type="button"
                className="field-add"
                onClick={link.onClick}
              >
                {link.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex-1">
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
          id={`compose-${field}`}
          className="input !rounded-md !py-2 text-sm"
          placeholder={RECIPIENT_PLACEHOLDER[field]}
          value={value}
          onChange={(e) => onChange(e.target.value)}
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

export function Composer({
  defaultFromName,
  defaultFromAlias,
}: {
  defaultFromName: string;
  defaultFromAlias: string;
}) {
  const router = useRouter();
  const editorRef = useRef<RichEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSendRef = useRef<SendPayload | null>(null);
  const submittingRef = useRef(false);

  const [toList, setToList] = useState<string[]>([]);
  const [ccList, setCcList] = useState<string[]>([]);
  const [bccList, setBccList] = useState<string[]>([]);
  const [inputs, setInputs] = useState<Record<RecipientField, string>>({
    to: "",
    cc: "",
    bcc: "",
  });
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [fromChoice, setFromChoice] = useState<"default" | "custom">("default");
  const [customFromName, setCustomFromName] = useState("");
  const [customFromAlias, setCustomFromAlias] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardQuota, setGuardQuota] = useState<{
    sentToday: number;
    dailyLimit: number;
    coldCeiling: number;
  } | null>(null);

  /* ---------------- templates ---------------- */

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [templatesError, setTemplatesError] = useState(false);
  const templatesTriggerRef = useRef<HTMLButtonElement>(null);

  async function openTemplates() {
    const next = !templatesOpen;
    setTemplatesOpen(next);
    if (next) {
      try {
        setTemplatesError(false);
        const res = await fetch("/api/templates");
        if (res.ok) {
          const data = (await res.json()) as { templates: TemplateSummary[] };
          setTemplates(data.templates);
        } else {
          setTemplatesError(true);
        }
      } catch {
        setTemplatesError(true);
      }
    }
  }

  function closeTemplates() {
    setTemplatesOpen(false);
    templatesTriggerRef.current?.focus();
  }

  function insertTemplate(t: TemplateSummary) {
    editorRef.current?.insertHtml(highlightTokens(t.html));
    editorRef.current?.focus();
    setTemplatesOpen(false);
  }

  const defaultFrom = `${defaultFromName || site.name} <${formatSenderAddress(defaultFromAlias)}>`;

  /* ---------------- recipients ---------------- */

  function setListFor(field: RecipientField, updater: (prev: string[]) => string[]) {
    if (field === "to") setToList(updater);
    else if (field === "cc") setCcList(updater);
    else setBccList(updater);
  }

  function addRecipients(field: RecipientField, raw: string) {
    const parsed = raw
      .split(/[;,\n]/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const valid = parsed.filter((e) => EMAIL_RE.test(e));
    const bad = parsed.filter((e) => !EMAIL_RE.test(e));
    setListFor(field, (prev) => [...new Set([...prev, ...valid])]);
    setInputs((prev) => ({ ...prev, [field]: "" }));
    if (bad.length > 0) {
      setError(`Ignored invalid address(es): ${bad.join(", ")}`);
    } else {
      setError(null);
    }
  }

  function removeRecipient(field: RecipientField, email: string) {
    setListFor(field, (prev) => prev.filter((e) => e !== email));
  }

  /* ---------------- attachments ---------------- */

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setError(null);

    // Running total across the whole batch (state may be stale mid-loop).
    let runningTotal = attachments.reduce((s, a) => s + a.size, 0);

    for (const file of files) {
      if (file.size > EMAIL_LIMITS.maxAttachmentBytes) {
        setError(`"${file.name}" exceeds the 6 MB file limit.`);
        continue;
      }
      runningTotal += file.size;
      if (runningTotal > EMAIL_LIMITS.maxTotalAttachmentBytes) {
        setError("Total attachment size exceeds the 18 MB limit.");
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        const base64 = dataUrl.split(",")[1] ?? "";
        setAttachments((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            content: base64,
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }

  /* ---------------- preview ---------------- */

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewTokens, setPreviewTokens] = useState(false);

  async function openPreview() {
    const bodyHtml = editorRef.current?.getHTML() ?? html;
    if (!bodyHtml.trim()) {
      setError("Write a message before previewing.");
      return;
    }
    setPreviewBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: bodyHtml }),
      });
      const data = (await res.json().catch(() => null)) as {
        html?: string;
        unresolvedTokens?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.html) {
        setError(data?.error ?? "Could not render preview.");
        return;
      }
      setPreviewHtml(data.html);
      setPreviewTokens(Boolean(data.unresolvedTokens));
      setPreviewOpen(true);
    } catch {
      setError("Could not render preview. Check your connection.");
    } finally {
      setPreviewBusy(false);
    }
  }

  function closePreview() {
    setPreviewOpen(false);
    setPreviewHtml(null);
  }

  /* ---------------- send ---------------- */

  interface SendPayload {
    to: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    html: string;
    fromName: string;
    fromAlias: string;
    attachments: ComposerAttachment[];
  }

  function buildPayload(fromName: string, fromAlias: string, bodyHtml: string): SendPayload {
    return {
      to: [...toList],
      cc: [...ccList],
      bcc: [...bccList],
      subject: subject.trim(),
      html: bodyHtml,
      fromName,
      fromAlias,
      attachments: [...attachments],
    };
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    setError(null);

    const allRecipients = [...toList, ...ccList, ...bccList];
    if (toList.length === 0) {
      setError("Add at least one recipient.");
      return;
    }
    if (allRecipients.length > EMAIL_LIMITS.maxRecipients) {
      setError(`Total recipients (To, Cc, Bcc) cannot exceed ${EMAIL_LIMITS.maxRecipients}.`);
      return;
    }
    if (!subject.trim()) {
      setError("Add a subject line.");
      return;
    }
    const bodyHtml = editorRef.current?.getHTML() ?? html;
    if (!bodyHtml.trim()) {
      setError("Write a message before sending.");
      return;
    }
    if (hasUnresolvedTokens(bodyHtml)) {
      setError("Template tokens remain unreplaced ({{…}}). Replace or remove them before sending.");
      return;
    }

    const fromName =
      fromChoice === "custom" && customFromName.trim()
        ? customFromName.trim()
        : defaultFromName;
    const fromAlias =
      fromChoice === "custom" && customFromAlias.trim()
        ? customFromAlias.trim()
        : defaultFromAlias;

    // Snapshot the whole payload now. Anything after this point may change
    // while the dialog is open, and a send must match what the user saw.
    const payload = buildPayload(fromName, fromAlias, bodyHtml);
    submittingRef.current = true;

    try {
      // --- Send guard: warn at the cold-outreach ceiling or 50% of the daily
      // limit; the hard wall (100% of the limit) is enforced server-side.
      let guardShown = false;
      try {
        const quotaRes = await fetch(
          `/api/send/quota?alias=${encodeURIComponent(fromAlias)}`,
        );
        if (quotaRes.ok) {
          const quota = (await quotaRes.json()) as {
            sentToday: number;
            dailyLimit: number;
            coldCeiling: number;
          };
          if (quota.sentToday >= quota.dailyLimit) {
            setError(
              `Daily send limit (${quota.dailyLimit}) reached. Try again tomorrow.`,
            );
            return;
          }
          if (
            (quota.coldCeiling > 0 && quota.sentToday >= quota.coldCeiling) ||
            quota.sentToday / quota.dailyLimit >= 0.5
          ) {
            pendingSendRef.current = payload;
            setGuardQuota(quota);
            guardShown = true;
            return;
          }
        }
      } catch {
        // Quota unavailable. The server hard wall still protects the limit.
      }

      if (!guardShown) {
        await performSend(payload);
      }
    } finally {
      submittingRef.current = false;
    }
  }

  function confirmGuardSend() {
    const pending = pendingSendRef.current;
    pendingSendRef.current = null;
    setGuardQuota(null);
    if (pending) void performSend(pending);
  }

  async function performSend(payload: SendPayload) {
    if (sending) return;
    setSending(true);

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: payload.to,
          cc: payload.cc,
          bcc: payload.bcc,
          subject: payload.subject,
          html: payload.html,
          fromName: payload.fromName,
          fromAlias: payload.fromAlias,
          attachments: payload.attachments,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        error?: string;
        details?: string;
        threadId?: string;
      } | null;

      if (!res.ok || data?.error || !data) {
        setError(
          data?.details
            ? `${data.error ?? "Message failed to send."} (${data.details})`
            : (data?.error ?? "Message failed to send."),
        );
        return;
      }

      router.push(data?.threadId ? `/dashboard?thread=${data.threadId}` : "/dashboard");
    } catch {
      setError("Message failed to send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">New Correspondence</p>
          <h1 className="font-serif text-3xl text-ink">Compose</h1>
        </div>
        <div className="relative mt-1">
          <button
            ref={templatesTriggerRef}
            type="button"
            className="btn btn--ghost btn--small !rounded-md"
            aria-expanded={templatesOpen}
            aria-haspopup="menu"
            onClick={openTemplates}
          >
            <FileText size={13} weight="bold" />
            Templates
          </button>
          {templatesOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-(--z-dropdown-backdrop) cursor-default"
                tabIndex={-1}
                aria-label="Close template picker"
                onClick={closeTemplates}
              />
              <div
                className="popover right-0 top-full mt-2 w-80 max-h-[22rem] overflow-y-auto p-2"
                data-open="true"
                role="menu"
                aria-label="Email templates"
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeTemplates();
                }}
              >
                {templates === null ? (
                  <p className="px-3 py-4 text-xs text-muted">
                    {templatesError
                      ? "Could not load templates. Close and try again."
                      : "Loading templates…"}
                  </p>
                ) : templates.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-muted">
                    No templates yet. Add one from Settings.
                  </p>
                ) : (
                  templates.map((t) => (
                    <button
                      key={t._id}
                      type="button"
                      role="menuitem"
                      className="w-full rounded-md px-3 py-2.5 text-left transition-colors duration-[160ms] hover:bg-sage-soft"
                      onClick={() => insertTemplate(t)}
                    >
                      <span className="block text-[0.83rem] font-medium text-ink">
                        {t.name}
                      </span>
                      {t.description ? (
                        <span className="mt-0.5 block text-xs leading-snug text-muted">
                          {t.description}
                        </span>
                      ) : null}
                      {t.tokens.length > 0 ? (
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          {t.tokens.slice(0, 5).map((token) => (
                            <span
                              key={token}
                              className="rounded bg-cream px-1.5 py-0.5 font-mono text-[0.6rem] text-sage-text"
                            >
                              {`{{${token}}}`}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>
      </header>

      <form onSubmit={send} className="panel overflow-hidden">
        {/* From */}
        <div className="flex flex-col gap-2.5 border-b border-line px-5 py-3.5 sm:flex-row sm:items-center">
          <label className="field-label mb-0 w-20 shrink-0 pt-1" htmlFor="compose-from">
            From
          </label>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <select
              id="compose-from"
              className="input !w-auto !rounded-md !py-2 text-sm"
              value={fromChoice}
              onChange={(e) => setFromChoice(e.target.value as "default" | "custom")}
            >
              <option value="default">{defaultFromName || site.name}</option>
              <option value="custom">Custom…</option>
            </select>
            {fromChoice === "custom" ? (
              <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                <input
                  className="input flex-1 !rounded-md !py-2 text-sm"
                  placeholder="Sender name"
                  value={customFromName}
                  onChange={(e) => setCustomFromName(e.target.value)}
                />
                <input
                  className="input flex-1 !rounded-md !py-2 text-sm"
                  placeholder={`alias@${site.mailDomain}`}
                  value={customFromAlias}
                  onChange={(e) => setCustomFromAlias(e.target.value)}
                />
              </div>
            ) : (
              <span className="hidden truncate font-mono text-[0.66rem] text-muted sm:inline">
                {defaultFrom}
              </span>
            )}
          </div>
        </div>

        {/* To / Cc / Bcc */}
        <div className="border-b border-line px-5">
          <RecipientRow
            field="to"
            label="To"
            list={toList}
            value={inputs.to}
            onChange={(v) => setInputs((prev) => ({ ...prev, to: v }))}
            onAdd={() => addRecipients("to", inputs.to)}
            onRemove={(email) => removeRecipient("to", email)}
            addLinks={
              !showCc || !showBcc
                ? [
                    ...(!showCc ? [{ label: "Cc", onClick: () => setShowCc(true) }] : []),
                    ...(!showBcc ? [{ label: "Bcc", onClick: () => setShowBcc(true) }] : []),
                  ]
                : undefined
            }
          />
          {showCc ? (
            <div className="border-t border-line">
              <RecipientRow
                field="cc"
                label="Cc"
                list={ccList}
                value={inputs.cc}
                onChange={(v) => setInputs((prev) => ({ ...prev, cc: v }))}
                onAdd={() => addRecipients("cc", inputs.cc)}
                onRemove={(email) => removeRecipient("cc", email)}
              />
            </div>
          ) : null}
          {showBcc ? (
            <div className="border-t border-line">
              <RecipientRow
                field="bcc"
                label="Bcc"
                list={bccList}
                value={inputs.bcc}
                onChange={(v) => setInputs((prev) => ({ ...prev, bcc: v }))}
                onAdd={() => addRecipients("bcc", inputs.bcc)}
                onRemove={(email) => removeRecipient("bcc", email)}
              />
            </div>
          ) : null}
        </div>

        {/* Subject */}
        <div className="flex items-center gap-4 border-b border-line px-5 py-3.5">
          <label className="field-label mb-0 w-20 shrink-0 pt-1" htmlFor="compose-subject">
            Subject
          </label>
          <input
            id="compose-subject"
            className="input !rounded-md !py-2 text-sm"
            placeholder="Subject line"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        {/* Editor */}
        <div className="px-5 pt-4">
          <RichEditor
            ref={editorRef}
            initialHtml={html}
            onChange={setHtml}
          />
        </div>

        {/* Attachments */}
        <div className="border-t border-line px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn--ghost btn--small !rounded-md"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={13} weight="bold" />
              Attach files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={onFilesSelected}
            />
            {attachments.map((a) => (
              <span key={a.id} className="chip">
                {a.filename}
                <span className="text-muted">· {Math.round(a.size / 1024)} KB</span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((x) => x.id !== a.id))
                  }
                  className="text-muted hover:text-ink"
                  aria-label={`Remove ${a.filename}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-4 border-t border-line bg-cream/50 px-5 py-4">
          <button
            type="button"
            className="btn btn--ghost btn--small !rounded-md"
            disabled={previewBusy}
            onClick={openPreview}
          >
            <Eye size={13} weight="bold" />
            {previewBusy ? "Rendering…" : "Preview"}
          </button>
          <button type="submit" className="btn btn--solid" disabled={sending}>
            <PaperPlaneTilt size={13} weight="bold" />
            {sending ? "Sending…" : "Send message"}
          </button>
          {error ? <p className="text-xs text-ink" role="alert">{error}</p> : null}
        </div>
      </form>

      {previewOpen && previewHtml ? (
        <div
          className="fixed inset-0 z-(--z-dialog-backdrop) flex items-center justify-center bg-ink/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Email preview"
          onClick={closePreview}
        >
          <div
            className="panel flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <div>
                <p className="eyebrow">Email preview</p>
                {previewTokens ? (
                  <p className="mt-0.5 text-xs text-ink">
                    Template tokens remain unreplaced ({"{{…}}"}) and will block
                    the send until filled.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--small !rounded-md"
                onClick={closePreview}
              >
                Close
              </button>
            </div>
            <iframe
              title="Email preview"
              sandbox="allow-popups"
              srcDoc={previewHtml}
              className="w-full flex-1 border-0 bg-cream"
            />
          </div>
        </div>
      ) : null}

      <SendGuardDialog
        open={guardQuota !== null}
        sentToday={guardQuota?.sentToday ?? 0}
        dailyLimit={guardQuota?.dailyLimit ?? 0}
        coldCeiling={guardQuota?.coldCeiling ?? 0}
        onConfirm={confirmGuardSend}
        onCancel={() => setGuardQuota(null)}
      />
    </div>
  );
}
