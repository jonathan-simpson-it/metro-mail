import { site } from "@/lib/site";

/**
 * Personalisation for cold outreach. One custom email per prospect,
 * matched to their job description. Maps prospect fields onto template
 * tokens; tokens with no value are left in place so the composer highlights
 * them as unresolved chips and blocks the send until they are filled.
 */

export interface ProspectFields {
  name: string;
  company: string;
  role: string;
  listing: string;
  notes: string;
  context: string;
  valueLine: string;
}

export function personalize(html: string, p: ProspectFields): string {
  const firstName = p.name.trim().split(/\s+/)[0] || p.name;
  const map: Record<string, string> = {
    ContactName: p.name.trim(),
    FirstName: firstName,
    Company: p.company.trim(),
    Role: p.role.trim(),
    ListingTitle: p.role.trim(),
    Listing: p.listing.trim(),
    JobDescription: p.listing.trim(),
    ContextLine: p.context.trim() || p.listing.trim(),
    Signal: p.notes.trim(),
    Notes: p.notes.trim(),
    ValueLine: p.valueLine.trim(),
    FounderName: site.founderName,
    CoFounderName: site.coFounderName,
    WebsiteUrl: site.website,
    PortalUrl: site.automationPortal,
  };

  return html.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_m, key: string) => {
    const normalized = key.trim().replace(/\s+/g, "");
    const value = map[normalized];
    return value !== undefined && value !== "" ? value : `{{${key.trim()}}}`;
  });
}

/**
 * Wraps unreplaced {{tokens}} in a highlighted chip inside the editor.
 * Attribute values are protected first so a token like {{ProfileURL}}
 * inside href="…" is never wrapped into malformed markup; tokens are only
 * highlighted in text position. The token value is HTML-escaped for the
 * data-token attribute so the produced string is valid HTML regardless of
 * consumer (ProseMirror whitelists attributes anyway).
 */
export function highlightTokens(html: string): string {
  // NULs would collide with the attribute-protection sentinel. Strip first.
  const cleaned = html.replace(/\u0000/g, "");
  const attrValues: string[] = [];
  const protectedHtml = cleaned.replace(
    /(\s[\w-]+=")([^"]*)(")/g,
    (_m, open: string, val: string, close: string) => {
      attrValues.push(val);
      return `${open}\u0000${attrValues.length - 1}\u0000${close}`;
    },
  );
  const wrapped = protectedHtml.replace(/\{\{([^{}]+)\}\}/g, (_m, token: string) => {
    const t = token.trim();
    const safe = t
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<span data-token="${safe}">{{${safe}}}</span>`;
  });
  return wrapped.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => attrValues[Number(i)]);
}
