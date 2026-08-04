export const site = {
  name: "Jonathan Simpson & Co.",
  shortName: "JS&C",
  productName: "MetroMail",
  tagline: "Corporate communications, engineered.",
  domain: "jonathansimpson.co",
  mailDomain: "mail.jonathansimpson.co",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  website: "https://jonathansimpson.co",
  linkedin: "https://www.linkedin.com/company/jonathan-simpson-co",
  blog: "https://jonathansimpson.co/blog",
  work: "https://jonathansimpson.co/work",
  contact: "https://jonathansimpson.co/contact",
  products: "https://jonathansimpson.co/products",
  automationPortal: "https://automation.jonathansimpson.co",
  /** Signatories used by cold-outreach template tokens. */
  founderName: "Devano Jonathan",
  coFounderName: "Lewis Simpson",
  /** Ink-on-transparent logo variant for light UI surfaces. */
  brandLogoInk: "/brand/jsc-mark-ink.svg",
  /** Fully-qualified email logo URL — email clients cannot resolve relative paths. */
  emailLogoUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/brand/JSC-logo.png`,
} as const;

if (
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_PUBLIC_APP_URL
) {
  throw new Error(
    "NEXT_PUBLIC_APP_URL must be set in production — outbound emails embed it for the logo and links.",
  );
}

export const DEFAULT_SENDER_NAME = "Jonathan Simpson & Co.";
export const DEFAULT_SENDER_ALIAS = "mail";

export function formatSenderAddress(
  alias: string | undefined | null,
  domain = site.mailDomain,
) {
  const local = alias?.trim() ? alias.trim().replace(/@.*$/, "") : DEFAULT_SENDER_ALIAS;
  return `${local}@${domain}`;
}

/** Sanitizes user-supplied display names for use in the From header. */
export function sanitizeFromName(name: string): string {
  return name
    .replace(/[\r\n\0"<>]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, 64);
}

/** Validates a local-part alias for the From header. */
export function isValidAlias(alias: string): boolean {
  return /^[a-z0-9._+-]{1,64}$/i.test(alias.trim());
}

/**
 * Single source of truth for resolving a user-supplied From alias.
 * Valid aliases are normalized to lowercase; anything else falls back.
 * Both /api/send (hard wall) and /api/send/quota (guard) must use this
 * so the mailbox being counted is always the mailbox that would send.
 */
export function resolveSenderAlias(
  raw: string | undefined | null,
  fallback = DEFAULT_SENDER_ALIAS,
): string {
  const candidate = raw?.trim() ?? "";
  return isValidAlias(candidate) ? candidate.toLowerCase() : fallback;
}

/** Strips CR/LF and other header-dangerous control characters. */
export function stripHeaderControl(value: string): string {
  return value.replace(/[\r\n\0]/g, "").trim();
}
