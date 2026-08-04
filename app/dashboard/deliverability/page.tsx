import type { DeliverabilityData } from "@/lib/deliverability";
import { getDeliverabilityData } from "@/lib/deliverability";
import { RAMP_BY_STATE, RAMP_SCHEDULE } from "@/lib/warmth";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

const EXTERNAL_CHECKS = [
  {
    label: "SENDERSCORE.ORG",
    url: "https://www.senderscore.org/",
    note: "Validity's 0–100 reputation score for your sending IP / domain.",
  },
  {
    label: "POSTMASTER.GOOGLE.COM",
    url: "https://postmaster.google.com/",
    note: "Gmail's own reputation view: Poor / Low / Medium / High + spam rate.",
  },
  {
    label: "SNDS.MICROSOFT.COM",
    url: "https://sendersupport.olc.protection.outlook.com/snds/",
    note: "Microsoft's sender data for Outlook / Hotmail placement.",
  },
  {
    label: "MXTOOLBOX.COM",
    url: "https://mxtoolbox.com/blacklists.aspx",
    note: "Blacklist membership check for your IP and domain.",
  },
  {
    label: "MAIL-TESTER.COM",
    url: "https://www.mail-tester.com/",
    note: "Send a test email to get a 0–10 deliverability score with detail.",
  },
  {
    label: "DMARCIAN.COM",
    url: "https://dmarcian.com/domain-checker/",
    note: "Free DMARC inspection and reporting.",
  },
];

function pct(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatDate(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <span className="text-[0.7rem] uppercase tracking-[0.08em] text-muted">
        {label}
        {note ? <span className="ml-2 font-normal normal-case tracking-normal text-sage-text">{note}</span> : null}
      </span>
      <span className="font-mono text-[0.95rem] text-ink">{value}</span>
    </div>
  );
}

function FactorRow({ label, weight, earned, note }: { label: string; weight: number; earned: number; note: string }) {
  return (
    <div className="border-b border-line py-2.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[0.7rem] uppercase tracking-[0.08em] text-muted">{label}</span>
        <span className="font-mono text-[0.85rem] text-ink">
          {earned}/{weight}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-sage"
          style={{ width: `${Math.min(100, (earned / weight) * 100)}%` }}
        />
      </div>
      <p className="mt-1 text-xs leading-snug text-muted">{note}</p>
    </div>
  );
}

export default async function DeliverabilityPage() {
  const data: DeliverabilityData = await getDeliverabilityData();
  const { stats, warmth, domain, dailyVolume, recentEvents, trackingEnabled } = data;

  const maxBar = dailyVolume.reduce((m, d) => Math.max(m, d.count), 1);
  const ramp = RAMP_BY_STATE[warmth.state];

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8">
      <header className="mb-6">
        <p className="eyebrow mb-2">Sender Health</p>
        <h1 className="font-serif text-3xl text-ink">Deliverability</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- Warmth ---------- */}
        <section className="panel p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-lg text-ink">Domain warmth</h2>
            <span className="rounded-full bg-sage-soft px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-sage-text">
              {warmth.state}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Estimated 0–100 from locally verifiable signals. The true score
            lives with Google, Microsoft and Validity — see External checks.
          </p>
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-2xl text-ink">{warmth.score}</span>
              <span className="text-[0.68rem] uppercase tracking-[0.08em] text-muted">
                / 100
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-sage"
                style={{ width: `${warmth.score}%` }}
              />
            </div>
          </div>
          <div className="mt-5">
            {warmth.factors.map((f) => (
              <FactorRow key={f.label} {...f} />
            ))}
          </div>
        </section>

        {/* ---------- Domain health ---------- */}
        <section className="panel p-6">
          <h2 className="font-serif text-lg text-ink">Sending domain</h2>
          <p className="mt-1 truncate font-mono text-[0.66rem] text-sage-text">
            {domain ? domain.name : site.mailDomain}
          </p>
          {domain ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sage-soft px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-sage-text">
                  {domain.status}
                </span>
                {domain.openTracking ? (
                  <span className="rounded-full bg-cream px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">
                    Opens tracked
                  </span>
                ) : null}
                {domain.clickTracking ? (
                  <span className="rounded-full bg-cream px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">
                    Clicks tracked
                  </span>
                ) : null}
                {!trackingEnabled ? (
                  <span className="text-[0.68rem] text-muted">
                    Tracking off — open/click stats unavailable. Enable it in
                    Resend (domain settings).
                  </span>
                ) : null}
              </div>
              <div className="mt-4">
                {domain.records.map((r) => (
                  <div
                    key={`${r.type}-${r.name}`}
                    className="flex items-center justify-between gap-4 border-b border-line py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[0.68rem] uppercase tracking-[0.06em] text-ink">
                        {r.type || "record"}
                      </p>
                      <p className="truncate font-mono text-[0.62rem] text-muted">
                        {r.name || "—"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.06em] ${
                        r.status === "verified"
                          ? "bg-sage-soft text-sage-text"
                          : "bg-cream text-muted"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Could not reach the Resend domains API. Add{" "}
              <code className="font-mono text-[0.78rem] text-ink">RESEND_API_KEY</code>{" "}
              to see SPF / DKIM / DMARC record status.
            </p>
          )}
        </section>

        {/* ---------- Analytics ---------- */}
        <section className="panel p-6">
          <h2 className="font-serif text-lg text-ink">Last 30 days</h2>
          <div className="mt-3">
            <StatRow label="Sent" value={String(stats.sent30)} />
            <StatRow label="Delivered" value={String(stats.delivered30)} />
            <StatRow label="Bounce rate" value={pct(stats.bounceRate)} note="target <2%" />
            <StatRow label="Complaint rate" value={pct(stats.complaintRate)} note="target <0.1%" />
            <StatRow label="Unique open rate" value={trackingEnabled ? pct(stats.openRate) : "—"} note="target 50%+" />
            <StatRow label="Unique click rate" value={trackingEnabled ? pct(stats.clickRate) : "—"} />
            <StatRow label="Reply rate" value={pct(stats.replyRate)} note="cold: 1–5%" />
            <StatRow label="Replies received" value={String(stats.replies30)} />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-[0.7rem] uppercase tracking-[0.08em] text-muted">
              Daily sends
            </p>
            <div className="flex h-12 items-end gap-[3px]">
              {dailyVolume.length === 0 ? (
                <span className="text-xs text-muted">No sends in the last 30 days.</span>
              ) : (
                dailyVolume.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 rounded-t-sm bg-ink/70"
                    style={{ height: `${Math.max(6, (d.count / maxBar) * 100)}%` }}
                    title={`${d.date}: ${d.count}`}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        {/* ---------- Send plan + ramp ---------- */}
        <section className="panel p-6">
          <h2 className="font-serif text-lg text-ink">How to send more</h2>
          <div className="mt-3 rounded-md border border-line bg-cream/50 p-4">
            <p className="text-[0.7rem] uppercase tracking-[0.08em] text-muted">
              Recommended today ({warmth.state} state)
            </p>
            <p className="mt-1 font-mono text-2xl text-ink">
              {ramp.daily} <span className="text-sm text-muted">/ day</span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{ramp.note}</p>
          </div>
          <div className="mt-4">
            {RAMP_SCHEDULE.map((w) => (
              <div key={w.week} className="flex items-baseline gap-4 border-b border-line py-2 last:border-b-0">
                <span className="w-10 shrink-0 font-mono text-[0.68rem] uppercase text-sage-text">
                  W{w.week}
                </span>
                <span className="w-12 shrink-0 font-mono text-[0.85rem] text-ink">
                  {w.daily}/day
                </span>
                <span className="text-xs leading-snug text-muted">{w.condition}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Brakes: never more than double yesterday&apos;s volume, pause when bounces
            spike, and hold the line during complaint increases. The send guard
            in Compose and Campaign enforces the daily ceiling.
          </p>
        </section>

        {/* ---------- Guide + external checks ---------- */}
        <section className="panel p-6 lg:col-span-2">
          <h2 className="font-serif text-lg text-ink">What warmth actually means</h2>
          <div className="mt-3 grid gap-6 md:grid-cols-2">
            <div>
              <details className="group border-b border-line py-3">
                <summary className="cursor-pointer text-[0.83rem] font-medium text-ink">
                  Domain reputation, in plain terms
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Gmail, Outlook and friends silently score how trustworthy your
                  sending identity looks: verified records, consistent volume,
                  and how often recipients open, reply, bounce or complain. A
                  cold identity gets filtered to spam before anyone reads a word.
                </p>
              </details>
              <details className="group border-b border-line py-3">
                <summary className="cursor-pointer text-[0.83rem] font-medium text-ink">
                  Why we send from a subdomain
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Mail flows from mail.jonathansimpson.co, not the root domain.
                  If cold outreach ever damages the subdomain&apos;s reputation, the
                  root domain — your website, transactional mail, client
                  correspondence — stays clean. This isolation is the standard
                  cold-email architecture.
                </p>
              </details>
              <details className="group border-b border-line py-3">
                <summary className="cursor-pointer text-[0.83rem] font-medium text-ink">
                  What warming up means
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Providers build reputation from history: a brand-new identity
                  that suddenly sends 200 emails a day looks automated and gets
                  throttled. Warming is a gradual volume ramp (see the schedule)
                  plus positive signals — opens, replies, no bounces, no spam
                  complaints — over roughly 4–6 weeks. It cannot be rushed, and
                  stopping for weeks resets part of the progress.
                </p>
              </details>
              <details className="group border-b border-line py-3">
                <summary className="cursor-pointer text-[0.83rem] font-medium text-ink">
                  Warning signs
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Bounce rate above 5%, complaint rate above 0.1%, opens trending
                  down while volume climbs, or a single day more than triple your
                  average. Any of these is a reason to hold volume, not increase
                  it.
                </p>
              </details>
            </div>
            <div>
              <p className="mb-2 text-[0.7rem] uppercase tracking-[0.08em] text-muted">
                External checks — run these to see your real scores
              </p>
              <div className="flex flex-col gap-1.5">
                {EXTERNAL_CHECKS.map((c) => (
                  <a
                    key={c.url}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start justify-between gap-3 rounded-md border border-line px-3 py-2.5 transition-colors duration-[160ms] hover:border-sage-text"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[0.68rem] uppercase tracking-[0.06em] text-ink">
                        {c.label} ↗
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted">
                        {c.note}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Recent events ---------- */}
        <section className="panel p-6 lg:col-span-2">
          <h2 className="font-serif text-lg text-ink">Recent delivery events</h2>
          {recentEvents.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No delivery events yet. They appear as Resend webhooks fire — the
              same Svix-verified endpoint that handles inbound mail.
            </p>
          ) : (
            <div className="mt-3">
              {recentEvents.map((e) => (
                <div
                  key={e.resendEmailId}
                  className="flex items-center gap-4 border-b border-line py-2.5 last:border-b-0"
                >
                  <span className="w-24 shrink-0 font-mono text-[0.62rem] text-muted">
                    {formatDate(e.createdAt)}
                  </span>
                  <span className="w-24 shrink-0">
                    <span className="rounded-full bg-cream px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.06em] text-muted">
                      {e.type}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">
                    {e.subject ?? e.url ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
