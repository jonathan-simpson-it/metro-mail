# PRODUCT.md - MetroMail (Jonathan Simpson & Co.)

## Product
MetroMail is an internal-grade, dual-action email communications platform for **Jonathan Simpson & Co.** (`jonathansimpson.co`). It handles custom-domain inbound email (webhook → hydrate → thread → forward), thread visualization, and personal, plain-text outbound delivery via Resend on `mail.jonathansimpson.co` (no brand wrapper: outbound copy reads like a 1:1 note).

## Audience
Internal agency partners (Lewis Simpson, Devano Jonathan) + client operations. Signup is allowlist-only (`ALLOWED_EMAILS`). No public marketing surface. The landing page is an auth gate.

## Register
**App UI / tooling** (design serves the product). Split-pane mail client: thread rail + reader + composer + settings (routing rules, sender identity).

## Design
- Source of truth: `DESIGN.md` (agency system): warm cream `#f4f4ef` bg, near-black ink `#161714`, sage `#80988f` accent (only colour), Georgia serif for display/wordmark, Inter for body, IBM Plex Mono for metadata.
- Hybrid nod to the PLAN.md "Metro" brief: structural hairlines (1px `#d6d8d1` dividers), mono metadata, visible compartmentalisation: "modern classic" like the main site.
- Motion: fast (160–220ms), purposeful, `prefers-reduced-motion` respected. No decorative animation.

## Email templates
- Plain, personal, text-first: no brand wrapper, no banner, no logo, no footer card. Outbound copy reads like a 1:1 note (no em dashes, no bullet lists, at most one link).
- Body font: Inter/Helvetica/Arial stack (readable; never Georgia for paragraphs).
- Seeded templates live in `lib/seed-templates.ts` and are reseeded via `$set`; custom templates stored in Mongo.

## Key integrations
- **Better Auth** (MongoDB adapter, `mongodb` driver; email/password; allowlist hook; `fromName`/`fromAlias` additional fields).
- **Mongoose** models: `Thread`, `Message`, `RoutingRule` (per-alias forwarding map, `*` catch-all).
- **Resend** SDK v6: `emails.receiving.get`, `emails.receiving.forward`, `emails.send`, `webhooks.verify` (Svix headers).

## Team
Lewis Simpson, Devano Jonathan (internal partners).
