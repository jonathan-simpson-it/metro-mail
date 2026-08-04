"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CaretDown,
  Check,
  PencilSimple,
  Plus,
  SkipForward,
  TrashSimple,
} from "@phosphor-icons/react";
import { EMAIL_RE, hasUnresolvedTokens } from "@/lib/email-text";
import { formatSenderAddress } from "@/lib/site";
import { highlightTokens, personalize } from "@/lib/personalize";
import { RichEditor, type RichEditorHandle } from "./rich-editor";
import { SendGuardDialog } from "./send-guard-dialog";

export interface Prospect {
  _id: string;
  name: string;
  company: string;
  email: string;
  role: string;
  listing: string;
  notes: string;
  context: string;
  valueLine: string;
  status: "draft" | "sent" | "replied" | "skipped";
  sentAt?: string;
  threadId?: string;
  createdAt: string;
}

interface TemplateSummary {
  _id: string;
  name: string;
  description: string;
  html: string;
  tokens: string[];
}

const STATUS_LABEL: Record<Prospect["status"], string> = {
  draft: "Draft",
  sent: "Sent",
  replied: "Replied",
  skipped: "Skipped",
};

const STATUS_CHIP: Record<Prospect["status"], string> = {
  draft: "bg-cream text-muted",
  sent: "bg-sage-soft text-sage-text",
  replied: "bg-ink text-paper",
  skipped: "bg-line text-muted",
};

const EMPTY_FORM = {
  name: "",
  company: "",
  email: "",
  role: "",
  listing: "",
  notes: "",
  context: "",
  valueLine: "",
};

export function CampaignWorkspace({
  defaultFromName,
  defaultFromAlias,
}: {
  defaultFromName: string;
  defaultFromAlias: string;
}) {
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [templateId, setTemplateId] = useState<string>("");
  const [subjectDrafts, setSubjectDrafts] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const editorRef = useRef<RichEditorHandle>(null);

  // Quota indicator + send guard
  const [quota, setQuota] = useState<{
    sentToday: number;
    dailyLimit: number;
    coldCeiling: number;
  } | null>(null);
  const [guardQuota, setGuardQuota] = useState<typeof quota>(null);
  const pendingSendRef = useRef<{ bodyHtml: string } | null>(null);
  const submittingRef = useRef(false);

  const selected = prospects?.find((p) => p._id === selectedId) ?? null;

  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/send/quota");
      if (res.ok) setQuota((await res.json()) as typeof quota);
    } catch {
      // Indicator only. The server hard wall still protects the limit.
    }
  }, []);

  const loadAll = useCallback(async () => {
    const [pRes, tRes] = await Promise.all([
      fetch("/api/prospects"),
      fetch("/api/templates"),
    ]);
    if (pRes.ok) {
      const data = (await pRes.json()) as { prospects: Prospect[] };
      setProspects(data.prospects);
      setSelectedId((prev) =>
        prev && data.prospects.some((p) => p._id === prev)
          ? prev
          : (data.prospects[0]?._id ?? null),
      );
    }
    if (tRes.ok) {
      const data = (await tRes.json()) as { templates: TemplateSummary[] };
      setTemplates(data.templates);
      setTemplateId((prev) =>
        prev && data.templates.some((t) => t._id === prev)
          ? prev
          : (data.templates[0]?._id ?? ""),
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadAll();
      await refreshQuota();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll, refreshQuota]);

  /* ---------------- add prospects ---------------- */

  async function addSingle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { created?: number; skipped?: unknown[]; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Could not add prospect.");
        return;
      }
      setForm(EMPTY_FORM);
      setNotice(`Added ${data.created ?? 0} prospect(s).`);
      await loadAll();
    } catch {
      setError("Could not add prospect. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function addCsv() {
    const lines = csv
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, company, email, role, listing, notes] = line
          .split(",")
          .map((cell) => cell.trim());
        return { name, company, email, role, listing, notes, context: "", valueLine: "" };
      });
    // Drop an optional header row only when the first cell is exactly "name".
    if (lines.length > 0 && lines[0].name.toLowerCase() === "name") {
      lines.shift();
    }
    const rows = lines.filter((r) => r.email);
    if (rows.length === 0) {
      setError("Paste at least one row: name, company, email, role, listing, notes.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const data = (await res.json()) as { created?: number; skipped?: unknown[]; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Could not import prospects.");
        return;
      }
      setCsv("");
      setNotice(
        `Imported ${data.created ?? 0} prospect(s)${data.skipped?.length ? `, skipped ${data.skipped.length}` : ""}.`,
      );
      await loadAll();
    } catch {
      setError("Could not import prospects. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- prospect actions ---------------- */

  async function patchProspect(id: string, patch: Record<string, unknown>) {
    const res = await fetch("/api/prospects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    return res.ok;
  }

  async function setStatus(id: string, status: Prospect["status"]) {
    if (await patchProspect(id, { status })) await loadAll();
  }

  async function removeProspect(id: string) {
    if (!window.confirm("Remove this prospect?")) return;
    const res = await fetch(`/api/prospects?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setSelectedId(null);
      await loadAll();
    }
  }

  /* ---------------- draft + send ---------------- */

  function loadTemplate() {
    if (!selected || !templateId || !templates) return;
    const t = templates.find((x) => x._id === templateId);
    if (!t) return;
    const personalized = personalize(t.html, selected);
    // Insert at the cursor (matches composer behaviour), never silently
    // replaces whatever is already in the editor.
    editorRef.current?.insertHtml(highlightTokens(personalized));
    editorRef.current?.focus();
  }

  async function send() {
    if (!selected || submittingRef.current) return;
    setError(null);

    const bodyHtml = editorRef.current?.getHTML() ?? "";
    if (!bodyHtml.trim()) {
      setError("Write a message before sending.");
      return;
    }
    if (!subjectDrafts[selected._id]?.trim()) {
      setError("Add a subject line.");
      return;
    }
    if (!EMAIL_RE.test(selected.email)) {
      setError("This prospect has an invalid email address.");
      return;
    }
    if (hasUnresolvedTokens(bodyHtml)) {
      setError("Template tokens remain unreplaced ({{…}}). Fill them in the editor first.");
      return;
    }

    submittingRef.current = true;
    try {
      let guardShown = false;
      try {
        const quotaRes = await fetch("/api/send/quota");
        if (quotaRes.ok) {
          const q = (await quotaRes.json()) as {
            sentToday: number;
            dailyLimit: number;
            coldCeiling: number;
          } | null;
          if (q) {
            if (q.sentToday >= q.dailyLimit) {
              setError(`Daily send limit (${q.dailyLimit}) reached. Try again tomorrow.`);
              return;
            }
            if (
              (q.coldCeiling > 0 && q.sentToday >= q.coldCeiling) ||
              q.sentToday / q.dailyLimit >= 0.5
            ) {
              pendingSendRef.current = { bodyHtml };
              setGuardQuota(q);
              guardShown = true;
              return;
            }
          }
        }
      } catch {
        // Quota unavailable. The server hard wall still protects the limit.
      }

      if (!guardShown) {
        await performSend(bodyHtml);
      }
    } finally {
      submittingRef.current = false;
    }
  }

  function confirmGuardSend() {
    const pending = pendingSendRef.current;
    pendingSendRef.current = null;
    setGuardQuota(null);
    if (pending) void performSend(pending.bodyHtml);
  }

  async function performSend(bodyHtml: string) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: [selected.email],
          subject: subjectDrafts[selected._id]?.trim() ?? "",
          html: bodyHtml,
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
      await patchProspect(selected._id, {
        status: "sent",
        threadId: data.threadId,
      });
      await loadAll();
      await refreshQuota();
      setNotice(`Sent to ${selected.email}.`);
    } catch {
      setError("Message failed to send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const quotaPercent = quota
    ? Math.min(
        100,
        Math.round((quota.sentToday / Math.max(1, quota.coldCeiling)) * 100),
      )
    : 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Outreach Workspace</p>
          <h1 className="font-serif text-3xl text-ink">Campaign</h1>
        </div>
        {quota ? (
          <div className="mt-1 w-44">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted">
                {quota.sentToday} / {quota.coldCeiling} today
              </span>
              <span className="font-mono text-[0.66rem] text-sage-text">{quotaPercent}%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-sage"
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
            <p className="mt-1 text-[0.64rem] text-muted">
              Cold-outreach ceiling · hard limit {quota.dailyLimit}
            </p>
          </div>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(20rem,24rem)_1fr]">
        {/* ---------- Prospect list ---------- */}
        <section className="panel overflow-hidden self-start">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-serif text-base text-ink">Prospects</h2>
            <button
              type="button"
              className="btn btn--ghost btn--small !rounded-md"
              onClick={() => setShowAdd((v) => !v)}
            >
              <Plus size={13} weight="bold" />
              Add
            </button>
          </div>

          {showAdd ? (
            <div className="border-b border-line bg-cream/50 px-4 py-3">
              <form onSubmit={addSingle} className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input !rounded-md !py-1.5 text-sm"
                    placeholder="Name *"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                  <input
                    className="input !rounded-md !py-1.5 text-sm"
                    placeholder="Company"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  />
                </div>
                <input
                  className="input !rounded-md !py-1.5 text-sm"
                  placeholder="Email *"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
                <input
                  className="input !rounded-md !py-1.5 text-sm"
                  placeholder="Role / job title"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                />
                <textarea
                  className="input !rounded-md !py-1.5 text-sm"
                  placeholder="Job description / listing (the personalisation hook)"
                  rows={2}
                  value={form.listing}
                  onChange={(e) => setForm((f) => ({ ...f, listing: e.target.value }))}
                />
                <div className="flex gap-2">
                  <input
                    className="input flex-1 !rounded-md !py-1.5 text-sm"
                    placeholder="Value proposition"
                    value={form.valueLine}
                    onChange={(e) => setForm((f) => ({ ...f, valueLine: e.target.value }))}
                  />
                  <input
                    className="input flex-1 !rounded-md !py-1.5 text-sm"
                    placeholder="Notes / signal"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
                <button type="submit" className="btn btn--solid btn--small !rounded-md" disabled={busy}>
                  Add prospect
                </button>
              </form>

              <div className="mt-3 border-t border-line pt-3">
                <label className="field-label" htmlFor="campaign-csv">
                  Or paste a list (name, company, email, role, listing, notes. Simple CSV, no commas inside fields)
                </label>
                <textarea
                  id="campaign-csv"
                  className="input !rounded-md !py-1.5 font-mono text-[0.7rem]"
                  rows={3}
                  placeholder={"WYND Limited, WYND, hr@wynd.co, Account & Finance Intern, listing text…, notes…\nAcme Ltd, Acme, hello@acme.com, Ops Manager, …, …"}
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                />
                <button
                  type="button"
                  className="mt-2 btn btn--ghost btn--small !rounded-md"
                  disabled={busy || !csv.trim()}
                  onClick={addCsv}
                >
                  Import rows
                </button>
              </div>
            </div>
          ) : null}

          <div className="max-h-[calc(100dvh-16rem)] overflow-y-auto">
            {prospects === null ? (
              <p className="px-4 py-6 text-xs text-muted">Loading prospects…</p>
            ) : prospects.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="font-serif text-lg text-ink">No prospects yet</p>
                <p className="mx-auto mt-2 max-w-[26ch] text-xs leading-relaxed text-muted">
                  Add a prospect or paste a list above, then draft a personalised cold
                  email one at a time.
                </p>
              </div>
            ) : (
              prospects.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => setSelectedId(p._id)}
                  className={`block w-full border-b border-line px-4 py-3 text-left transition-colors duration-[160ms] ${
                    p._id === selectedId ? "bg-sage-soft/60" : "hover:bg-cream/70"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[0.85rem] font-medium text-ink">
                      {p.name}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.06em] ${STATUS_CHIP[p.status]}`}
                    >
                      {STATUS_LABEL[p.status]}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {p.company || p.role || p.email}
                  </span>
                  <span className="block truncate font-mono text-[0.64rem] text-sage-text">
                    {p.email}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        {/* ---------- Prospect detail / composer ---------- */}
        <section className="panel overflow-hidden self-start">
          {selected ? (
            <div>
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-xl text-ink">{selected.name}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.06em] ${STATUS_CHIP[selected.status]}`}
                    >
                      {STATUS_LABEL[selected.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[0.66rem] text-sage-text">
                    {selected.email}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {selected.status === "sent" ? (
                    <button
                      type="button"
                      className="btn btn--ghost btn--small !rounded-md"
                      onClick={() => setStatus(selected._id, "replied")}
                      title="Mark as replied"
                    >
                      <Check size={13} weight="bold" />
                      Replied
                    </button>
                  ) : null}
                  {selected.status === "draft" ? (
                    <button
                      type="button"
                      className="btn btn--ghost btn--small !rounded-md"
                      onClick={() => setStatus(selected._id, "skipped")}
                      title="Skip this prospect"
                    >
                      <SkipForward size={13} weight="bold" />
                      Skip
                    </button>
                  ) : null}
                  {selected.status !== "draft" ? (
                    <button
                      type="button"
                      className="btn btn--ghost btn--small !rounded-md"
                      onClick={() => setStatus(selected._id, "draft")}
                      title="Reset to draft"
                    >
                      <PencilSimple size={13} weight="bold" />
                      Draft
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn--ghost btn--small !rounded-md"
                    onClick={() => removeProspect(selected._id)}
                    title="Remove prospect"
                  >
                    <TrashSimple size={13} weight="bold" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
                <label className="field-label mb-0" htmlFor="campaign-template">
                  Template
                </label>
                <div className="relative">
                  <select
                    id="campaign-template"
                    className="input !w-auto !rounded-md !py-2 pr-8 text-sm"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    {templates === null ? (
                      <option>Loading…</option>
                    ) : (
                      templates.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name}
                        </option>
                      ))
                    )}
                  </select>
                  <CaretDown
                    size={13}
                    weight="bold"
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--small !rounded-md"
                  onClick={loadTemplate}
                >
                  Load
                </button>
                <span className="hidden text-[0.64rem] text-muted md:inline">
                  Tokens auto-filled from this prospect; leftovers are highlighted.
                </span>
              </div>

              <div className="flex items-center gap-4 px-5 pt-3.5">
                <label className="field-label mb-0 w-20 shrink-0 pt-1" htmlFor="campaign-subject">
                  Subject
                </label>
                <input
                  id="campaign-subject"
                  className="input !rounded-md !py-2 text-sm"
                  placeholder="Subject line"
                  value={subjectDrafts[selected._id] ?? ""}
                  onChange={(e) =>
                    setSubjectDrafts((prev) => ({
                      ...prev,
                      [selected._id]: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="px-5 pt-4">
                <RichEditor
                  key={selected._id}
                  ref={editorRef}
                  onChange={() => undefined}
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 border-t border-line bg-cream/50 px-5 py-4">
                <button
                  type="button"
                  className="btn btn--solid"
                  disabled={busy || selected.status === "sent"}
                  onClick={send}
                >
                  {busy ? "Sending…" : selected.status === "sent" ? "Already sent" : "Send to prospect"}
                </button>
                <span className="hidden truncate font-mono text-[0.64rem] text-muted md:inline">
                  Sending as {defaultFromName} · {formatSenderAddress(defaultFromAlias)}
                </span>
                {error ? <p className="text-xs text-ink" role="alert">{error}</p> : null}
                {notice ? <p className="text-xs text-sage-text">{notice}</p> : null}
              </div>
            </div>
          ) : (
            <div className="px-6 py-16 text-center">
              <p className="font-serif text-xl text-ink">Select a prospect</p>
              <p className="mx-auto mt-2 max-w-[36ch] text-xs leading-relaxed text-muted">
                Choose a prospect on the left to draft their personalised email.
              </p>
            </div>
          )}
        </section>
      </div>

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
