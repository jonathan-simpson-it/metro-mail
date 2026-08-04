# PRD.md: Jonathan Simpson & Co. Email Forwarding & Client Platform ("MetroMail")

## 1. Product Overview

**MetroMail** is an internal-grade, dual-action email communications platform built for **Jonathan Simpson & Co.** (`jonathansimpson.co`). It handles custom domain inbound email processing, automated routing/forwarding, sandboxed email thread visualization, and high-performance outbound delivery using **Resend** configured for `mail.jonathansimpson.co`.

- **Core Objective:** Eliminate reliance on legacy email forwarders, providing full-fidelity inbound webhooks, robust threading, local storage/database mapping via MongoDB, and a sleek, strict-geometry Metro-branded interface.
- **Target Users:** Internal agency partners (Lewis Simpson, Devano Jonathan) and client operations.

---

## 2. Technical Stack & Architecture

- **Framework:** Next.js (App Router, Latest) with TypeScript.
- **Database & ODM:** MongoDB via Mongoose (storing users, sessions, email threads, message fragments, and metadata logs).
- **Authentication:** Better Auth (handling secure cookie-based credential sessions).
- **Email Infrastructure:** Resend Node.js SDK (`resend`), configured with sending domain `mail.jonathansimpson.co` and inbound webhooks for receiving.
- **Styling & Design Engine:** Tailwind CSS adhering strictly to the agency’s `design.md` specs (high-contrast geometry, sharp borders, bold uppercase typography, solid color blocks).

---

## 3. Core Modules & Functional Requirements

### Module A: Authentication & Landing

- **Landing Page:** Minimalist single-view entry point featuring the authentication wall (`/login` & `/signup`) styled with Metro design constraints. No public marketing bloat—straight to utility.
- **Better Auth Integration:** Session-secured API endpoints protecting all dashboard and mail client routes.

### Module B: Inbound Receiving & Forwarding Engine (`mail.jonathansimpson.co`)

- **Webhook Receiver (`/api/webhooks/resend`)**:
- Captures `email.received` events from Resend.
- Verifies webhook signatures using `resend.webhooks.verify()` with Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`).

- **Metadata Hydration & Fetching**:
- Fetches full email payloads (HTML, text, attachments) via Resend's receiving API using the incoming `email_id`.

- **Simultaneous Forwarding & Persistence**:
- Forwards the incoming email to designated external human mailboxes while retaining a clean, indexed copy inside MongoDB.
- Auto-groups messages into conversation threads matching headers (`Message-ID`, `In-Reply-To`, `References`).

### Module C: Outbound Composition & Client Interface

- **Dual Editor Modes**:
- **WYSIWYG Mode:** Rich text formatting toolbar for standard dispatch.
- **HTML Code Mode:** Direct source injection for advanced templates.

- **Metro-Branded React Email Template Engine**:
- Outbound emails are wrapped in a custom layout mirroring the agency's `design.md` specs (sharp grid boundaries, high-contrast typography, structural cards).

- **File Attachments & Links**:
- Multi-file upload handlers supporting documents and media, mapping directly to Resend's `attachments` configuration array.

### Module D: Inbox & Thread Reader UI

- **Split-Pane Layout**: Left sidebar for real-time thread lists and filtering; right workspace for reading sanitized emails inside an isolated `iframe` sandbox (`sandbox="allow-popups"`).
- **Thread Reply Engine**: Context-aware reply box preserving conversation depth and automatically setting proper `Reply-To` parameters.

---

## 4. Database Schema (Mongoose Models)

- **User Model**: `id`, `name`, `email`, `image`, `createdAt`, `updatedAt`
- **Thread Model**: `id`, `subject`, `participants` [Array], `lastMessageAt`, `snippet`, `createdAt`
- **Message Model**: `id`, `threadId`, `resendEmailId`, `sender`, `recipient`, `subject`, `htmlBody`, `textBody`, `direction` ('inbound' | 'outbound'), `attachments` [Array], `createdAt`

---

---

# plan.md: Step-by-Step Implementation Roadmap

## Phase 1: Environment & Foundation Setup

- [ ] Initialize Next.js App Router project with TypeScript, Tailwind CSS, and Mongoose.
- [ ] Configure environment variables (`MONGODB_URI`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`).
- [ ] Establish MongoDB connection utility (`lib/mongoose.ts`).
- [ ] Implement **Better Auth** schema configuration and API route handler (`app/api/auth/[...all]/route.ts`).
- [ ] Build the minimalist landing/login gate page adhering strictly to the agency's `design.md`.

## Phase 2: Resend Inbound Webhook & Processing Pipeline

- [ ] Set up Mongoose schemas for `Thread` and `Message`.
- [ ] Implement the secure webhook receiver endpoint at `app/api/webhooks/resend/route.ts`:
- Add webhook verification using `resend.webhooks.verify()`.
- Handle `email.received` events, fetch full content via Resend API, and save to MongoDB.

- [ ] Implement automated email forwarding logic within the webhook worker to route inbound messages to destination boxes.

## Phase 3: Outbound Delivery & Metro Email Templates

- [ ] Create the Metro-branded React Email layout template reflecting the typography and geometry defined in `design.md`.
- [ ] Build the outbound API route (`app/api/send/route.ts`) interfacing with Resend using `mail.jonathansimpson.co` as the sender domain.
- [ ] Add support for file attachments and custom HTML input properties.

## Phase 4: Dashboard & Mail Client UI

- [ ] Create the main application layout (`/dashboard`) featuring a split-pane interface (Thread List + Reading/Writing View).
- [ ] Build the email reader component with an isolated, sanitized `iframe` sandboxed viewer.
- [ ] Build the hybrid composition view with a toggle between WYSIWYG editing and raw HTML mode.
- [ ] Implement thread reply functionality linking back to the outbound send pipeline.
