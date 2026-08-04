<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes: APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# MetroMail - JS&C Email Platform

## Project

Internal email communications platform for Jonathan Simpson & Co. (jonathansimpson.co).
Inbound: Resend webhook (`email.received`) → hydrate → thread → per-alias forward.
Outbound: branded React Email template → Resend on `mail.jonathansimpson.co`.
Auth: Better Auth (allowlist-only signup). Data: Mongoose (Thread / Message / RoutingRule).

## Commands

- `npm run dev`: dev server (Turbopack, port 3000)
- `npm run build`: production build (runs tsc; lint is NOT part of build)
- `npm run lint`: ESLint (flat config). NOTE: React Compiler purity rules apply: keep impure calls (`Date.now()` etc.) inside `lib/` functions, not route handlers.
- `npx tsc --noEmit`: type check

## Architecture map

- `lib/auth.ts`: lazy Better Auth instance (`getAuth()`), MongoDB adapter, allowlist hooks, rate limiting. Never import eagerly into client code.
- `lib/mongodb.ts` / `lib/mongoose.ts`: cached lazy connections (native driver for Better Auth, Mongoose for app models). Env var is `MONGO_URI`.
- `lib/resend.ts`: lazy `getResend()` (fails closed at request time, never at build time).
- `lib/inbound.ts`: webhook pipeline (idempotent per `resendEmailId`, E11000-safe, same-domain forward loop protection).
- `app/api/send/route.tsx`: outbound (server-side sanitize-html, CRLF-safe headers, daily cap via `lib/send-policy.ts`, reply threading via `In-Reply-To`/`References`).
- `app/api/webhooks/resend/route.ts`: Svix signature verification on raw body.
- `proxy.ts`: Next.js 16 proxy (NOT middleware): cookie-presence redirect guard only; real session checks are server-side per page/route.
- `emails/metro-layout.tsx`: React Email template: dark-stamp logo, Georgia wordmark, Inter body, sage hairlines, site links.

## Conventions / gotchas

- Next.js 16: `headers()`, `cookies()`, `params`, `searchParams` are ALL async: always `await`.
- Route handlers in `route.tsx` for JSX (e.g. `app/api/send/route.tsx`).
- Folders prefixed `_` are private in Next.js (never routed).
- Dynamic pages that read sessions must export `export const dynamic = "force-dynamic"`.
- Email body font: Inter/Helvetica stack: NEVER Georgia for paragraphs (readable); Georgia only for headings/wordmark.
- Sage `#80988f` is decorative only; text on light surfaces uses `--color-sage-text` (#5f7067, WCAG AA).
- Design tokens live in `app/globals.css` (`@theme`): source of truth is `DESIGN.md`.
- `.env.local` is gitignored: use `.env.example` as the template.
