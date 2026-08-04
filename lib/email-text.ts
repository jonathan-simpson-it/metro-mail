/** Minimal HTML → text conversion for the outbound text alternative. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export { EMAIL_RE };

/** A fully-formed, unreplaced template token: {{Name}} (or empty {{}}) */
export const UNRESOLVED_TOKEN_RE = /{{[^{}]*}}/;

/** An unterminated token: {{Name without a closing brace */
export const UNCLOSED_TOKEN_RE = /{{[^{}]*$/;

/** True when the body still contains raw template tokens (open or closed). */
export function hasUnresolvedTokens(value: string): boolean {
  return UNRESOLVED_TOKEN_RE.test(value) || UNCLOSED_TOKEN_RE.test(value);
}

export const EMAIL_LIMITS = {
  maxRecipients: 50,
  maxSubjectChars: 500,
  maxHtmlBytes: 500_000,
  maxAttachmentBytes: 6 * 1024 * 1024, // 6 MB per file
  maxTotalAttachmentBytes: 18 * 1024 * 1024, // 18 MB per send
} as const;

export function isValidEmailList(values: unknown): values is string[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > 50) {
    return false;
  }
  return values.every((v) => typeof v === "string" && EMAIL_RE.test(v.trim()));
}
