# MetroMail - Jonathan Simpson & Co.

Internal email communications platform: inbound routing, thread visualization, and personal,
plain-text outbound delivery via Resend (no brand wrapper; cold outreach must read like a 1:1 note).

## Setup

1. `cp .env.example .env.local` and fill in real values:
   - `MONGO_URI`: MongoDB Atlas connection string
   - `RESEND_API_KEY`: resend.com/api-keys
   - `RESEND_WEBHOOK_SECRET`: from your Resend webhook config (see below)
   - `BETTER_AUTH_SECRET`: `openssl rand -base64 32`
   - `ALLOWED_EMAILS`: comma-separated signup allowlist (internal tool)
   - `NEXT_PUBLIC_APP_URL`: deployed origin; used for absolute asset URLs
2. `npm run dev` → http://localhost:3000

## Resend inbound setup

1. In Resend, add the MX records for `mail.jonathansimpson.co` (Receiving tab).
2. Create a webhook at `https://<your-app>/api/webhooks/resend` and subscribe
   to **all** of these events: inbound mail, plus the delivery analytics that
   power the Deliverability page:
   `email.received`, `email.sent`, `email.delivered`, `email.delivery_delayed`,
   `email.bounced`, `email.opened`, `email.clicked`, `email.complained`.
   Copy the signing secret into `RESEND_WEBHOOK_SECRET`.
3. Create routing rules in the app (Dashboard → Settings → Routing rules):
   `lewis` → lewis@gmail.com, `*` → catch-all for unmatched aliases.

## Sending

Outbound mail is sent from `mail.jonathansimpson.co` (verified in Resend). Per-user
sender identity is set in Settings (name + alias) and is overridable per message in
the composer. Replies preserve threading via `In-Reply-To` / `References`.

Cold outreach happens one personalised email at a time from the Campaign tab
(no broadcasts): prospects are stored per-email, template tokens are auto-filled
from each prospect's job description, and the send guard enforces a daily
cold-outreach ceiling (`SEND_COLD_CEILING`) with a hard wall at
`SEND_DAILY_LIMIT`. Delivery analytics, an estimated domain-warmth score and a
volume ramp plan live on the Deliverability tab.

## Security model

- Allowlist-only signup enforced server-side (Better Auth `databaseHooks`).
- Webhook requests verified with Svix signature on the raw body (fail closed).
- Inbound HTML is sanitised with DOMPurify and rendered in a `sandbox` iframe.
- Outbound HTML is sanitised server-side (`sanitize-html`) and sent as-is
  with no brand template wrapper.
- Sender name/alias are CRLF-stripped and validated; daily send cap per alias.
- Forwarding never targets the sending domain (webhook loop protection).
