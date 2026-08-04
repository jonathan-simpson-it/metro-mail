const PREFIXES = /^\s*(re|fwd?|aw|sv|antw|antwort|odp|tr):\s*/i;

/**
 * Normalises a subject line for thread matching:
 * strips reply/forward prefixes, collapses whitespace, lowercases.
 */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(PREFIXES, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Case-insensitive lookup of a raw email header (Resend returns lowercase keys). */
export function getHeader(
  headers: Record<string, unknown> | undefined | null,
  key: string,
): string | undefined {
  if (!headers) return undefined;
  const lower = key.toLowerCase();
  const hit = Object.keys(headers).find((k) => k.toLowerCase() === lower);
  const value = hit ? headers[hit] : undefined;
  if (value === undefined || value === null) return undefined;
  return String(value);
}

/** Splits a References header value into individual Message-IDs. */
export function parseReferences(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith("<") && s.endsWith(">"))
    .slice(0, 20);
}

/** Builds a References header chain for outbound replies. */
export function buildReferences(
  parentMessageId?: string,
  parentReferences: string[] = [],
): string[] {
  const chain = parentMessageId ? [...parentReferences, parentMessageId] : parentReferences;
  return chain.slice(-15);
}

export function snippetFromText(text?: string, length = 160): string {
  const clean = (text ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (clean.length <= length) return clean;
  return `${clean.slice(0, length).replace(/\s+\S*$/, "")}…`;
}
