"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword, updateUser } from "@/lib/auth-client";
import { formatSenderAddress, site } from "@/lib/site";

export interface RoutingRuleItem {
  id: string;
  alias: string;
  forwardTo: string[];
  active: boolean;
}

export function SettingsPanel({
  user,
  rules,
}: {
  user: {
    email: string;
    name: string;
    fromName?: string;
    fromAlias?: string;
  };
  rules: RoutingRuleItem[];
}) {
  const router = useRouter();

  /* ---------------- identity ---------------- */

  const [fromName, setFromName] = useState(user.fromName ?? "");
  const [fromAlias, setFromAlias] = useState(user.fromAlias ?? "");
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identitySaved, setIdentitySaved] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  async function saveIdentity(e: React.FormEvent) {
    e.preventDefault();
    setIdentitySaving(true);
    setIdentityError(null);

    const alias = fromAlias.trim().replace(/@.*$/, "");
    const { error } = await updateUser({
      name: user.name,
      fromName: fromName.trim(),
      fromAlias: alias,
    } as Parameters<typeof updateUser>[0]);

    setIdentitySaving(false);
    if (error) {
      setIdentityError(error.message ?? "Failed to save identity.");
      return;
    }
    setIdentitySaved(true);
    router.refresh();
    setTimeout(() => setIdentitySaved(false), 4000);
  }

  const previewFrom = `${fromName.trim() || site.name} <${formatSenderAddress(fromAlias)}>`;

  /* ---------------- password ---------------- */

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (!currentPassword) {
      setPasswordError("Enter your current password.");
      return;
    }

    setPasswordSaving(true);
    const { error } = await changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setPasswordSaving(false);

    if (error) {
      setPasswordError(error.message ?? "Failed to change password.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 4000);
  }

  /* ---------------- routing rules ---------------- */

  const [alias, setAlias] = useState("");
  const [destinations, setDestinations] = useState("");
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [ruleSaving, setRuleSaving] = useState(false);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setRuleSaving(true);
    setRuleError(null);

    const forwardTo = destinations
      .split(/[;,\n]/)
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    const res = await fetch("/api/routing-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias: alias.trim(), forwardTo }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;

    setRuleSaving(false);
    if (!res.ok) {
      setRuleError(data?.error ?? "Failed to create rule.");
      return;
    }
    setAlias("");
    setDestinations("");
    setRuleError(null);
    router.refresh();
  }

  async function toggleRule(rule: RoutingRuleItem) {
    await fetch("/api/routing-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, alias: rule.alias, forwardTo: rule.forwardTo, active: !rule.active }),
    });
    router.refresh();
  }

  async function deleteRule(id: string) {
    await fetch("/api/routing-rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  const sectionTitle = "font-serif text-xl text-ink";

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-8">
        <p className="eyebrow mb-2">Administration</p>
        <h1 className="font-serif text-3xl text-ink">Settings</h1>
      </header>

      {/* ---- Sender identity ---- */}
      <section className="panel mb-8 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className={sectionTitle}>Sender identity</h2>
          <p className="mt-1 text-xs text-muted">
            Default name and alias used when composing. Changeable per-message in the composer.
          </p>
        </div>
        <form onSubmit={saveIdentity} className="flex flex-col gap-4 px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fromName" className="field-label">
                Sender name
              </label>
              <input
                id="fromName"
                className="input"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder={site.name}
              />
            </div>
            <div>
              <label htmlFor="fromAlias" className="field-label">
                Alias
              </label>
              <div className="flex items-center">
                <input
                  id="fromAlias"
                  className="input rounded-r-none font-mono text-sm"
                  value={fromAlias}
                  onChange={(e) => setFromAlias(e.target.value)}
                  placeholder={user.email.split("@")[0]}
                />
                <span className="field-suffix font-mono text-sm">
                  @{site.mailDomain}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-line bg-cream/50 px-3 py-2">
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.1em] text-muted">
              Preview
            </p>
            <p className="mt-1 text-sm text-ink">{previewFrom}</p>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" className="btn btn--solid btn--small" disabled={identitySaving}>
              {identitySaving ? "Saving…" : "Save identity"}
            </button>
            {identitySaved ? (
              <span className="font-mono text-[0.66rem] tracking-[0.1em] text-sage-text">SAVED</span>
            ) : null}
            {identityError ? <span className="text-xs text-ink">{identityError}</span> : null}
          </div>
        </form>
      </section>

      {/* ---- Password ---- */}
      <section className="panel mb-8 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className={sectionTitle}>Password</h2>
          <p className="mt-1 text-xs text-muted">
            Set your own password here. Useful if your browser did not offer to save the
            generated one at signup.
          </p>
        </div>
        <form onSubmit={savePassword} className="flex flex-col gap-4 px-5 py-5">
          <div>
            <label htmlFor="currentPassword" className="field-label">
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="newPassword" className="field-label">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="field-label">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="btn btn--solid btn--small"
              disabled={passwordSaving}
            >
              {passwordSaving ? "Updating…" : "Change password"}
            </button>
            {passwordSaved ? (
              <span className="font-mono text-[0.72rem] tracking-[0.1em] text-sage-text">
                PASSWORD UPDATED · OTHER SESSIONS SIGNED OUT
              </span>
            ) : null}
            {passwordError ? <span className="text-xs text-ink">{passwordError}</span> : null}
          </div>
        </form>
      </section>

      {/* ---- Routing rules ---- */}
      <section className="panel overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className={sectionTitle}>Routing rules</h2>
          <p className="mt-1 text-xs text-muted">
            Inbound mail is forwarded to the destinations matched by its recipient alias.{" "}
            <span className="font-mono text-[0.7rem]">*</span> is the catch-all for unmatched
            aliases.
          </p>
        </div>

        {/* Add form */}
        <form onSubmit={createRule} className="grid gap-3 border-b border-line bg-cream/50 px-5 py-4 sm:grid-cols-[140px_1fr_auto]">
          <div>
            <label htmlFor="ruleAlias" className="field-label">
              Alias
            </label>
            <input
              id="ruleAlias"
              className="input font-mono text-sm"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="lewis or *"
            />
          </div>
          <div>
            <label htmlFor="ruleDests" className="field-label">
              Forward to
            </label>
            <input
              id="ruleDests"
              className="input font-mono text-sm"
              value={destinations}
              onChange={(e) => setDestinations(e.target.value)}
              placeholder="lewis@gmail.com, devano@outlook.com"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn--solid btn--small" disabled={ruleSaving}>
              Add rule
            </button>
          </div>
        </form>

        {ruleError ? (
          <p className="border-b border-line px-5 py-2 text-xs text-ink">{ruleError}</p>
        ) : null}

        {/* Rules list */}
        {rules.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-muted">
            No routing rules yet. Inbound mail is only stored, not forwarded.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="w-28 shrink-0 truncate font-mono text-sm text-ink">
                  {rule.alias === "*" ? "* (catch-all)" : `${rule.alias}@${site.mailDomain}`}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[0.72rem] text-muted">
                  → {rule.forwardTo.join(", ")}
                </span>
                <button
                  onClick={() => toggleRule(rule)}
                  className={`chip cursor-pointer hover:border-sage ${
                    rule.active ? "" : "opacity-50"
                  }`}
                  title={rule.active ? "Click to pause" : "Click to activate"}
                >
                  {rule.active ? "ACTIVE" : "PAUSED"}
                </button>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="text-xs text-muted hover:text-ink"
                  aria-label={`Delete rule for ${rule.alias}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
