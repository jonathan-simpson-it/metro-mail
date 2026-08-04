import { headers } from "next/headers";
import { render } from "@react-email/render";
import sanitizeHtml from "sanitize-html";
import { getAuth } from "@/lib/auth";
import { MetroEmailLayout } from "@/emails/metro-layout";
import { hasUnresolvedTokens } from "@/lib/email-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Renders the composer body inside the full branded MetroEmailLayout so the
 * user can preview exactly what a recipient will see before sending.
 * Session-gated; the body is sanitised with the same rules as /api/send.
 */
export async function POST(request: Request) {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: { html?: string } | null = null;
  try {
    body = (await request.json()) as { html?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const html = typeof body?.html === "string" ? body.html.trim() : "";
  if (!html || html.length > 500_000) {
    return Response.json({ error: "An HTML body is required (max 500 KB)." }, { status: 400 });
  }

  const safeHtml = sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "b", "strong", "i", "em", "u", "s", "strike", "a", "ul", "ol",
      "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "pre",
      "code", "table", "thead", "tbody", "tr", "th", "td", "img", "span", "div",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      span: ["style"],
      p: ["style"],
      div: ["style"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https", "http"] },
  });

  const rendered = await render(
    <MetroEmailLayout previewText="Email preview" contentHtml={safeHtml} />,
    { pretty: true },
  );

  return Response.json({
    html: rendered,
    unresolvedTokens: hasUnresolvedTokens(safeHtml),
  });
}
