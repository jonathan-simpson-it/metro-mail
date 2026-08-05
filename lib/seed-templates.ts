import { connectToDatabase } from "@/lib/mongoose";
import { Template, type ITemplate } from "@/models/Template";

/**
 * Cold-email starter pack - plain, personal, text-first. Emails are sent
 * with no brand wrapper (no banner, no logo, no footer card), so template
 * copy must read like a 1:1 note: short paragraphs, no bullet lists, one
 * low-friction CTA, single-person sign-off, at most one link. No em dashes.
 * Tokens like {{Company}} are replaced per-prospect in the Campaign workspace.
 */
const SEED_TEMPLATES: Omit<ITemplate, "createdAt" | "updatedAt">[] = [
  {
    name: "Cold Outreach",
    slug: "cold-outreach",
    description:
      "Personalised first touch: a genuine observation, one value line, one low-friction ask.",
    category: "cold-outreach",
    order: 10,
    tokens: [
      "ContactName",
      "Company",
      "ContextLine",
      "ListingTitle",
      "ValueLine",
      "FounderName",
    ],
    html: [
      "<p>Hi {{ContactName}},</p>",
      "<p>Congratulations on {{Company}}’s continued success as {{ContextLine}}. I saw your listing for {{ListingTitle}} and wanted to reach out directly.</p>",
      "<p>Managing membership billing, Xero accounting, and monthly reporting on an hourly basis can swallow a lot of time, and it is the kind of work that scales badly as you grow. We build custom automation for exactly this: Xero invoicing, bank reconciliation, and financial reports that run themselves. You keep the oversight; the manual data entry goes away.</p>",
      "<p>I put together a 30-second preview of how this could fit {{Company}}’s workflow. Would you be open to seeing it?</p>",
      "<p>Best,<br/>{{FounderName}}<br/>Jonathan Simpson &amp; Co. | jonathansimpson.co</p>",
    ].join(""),
  },
  {
    name: "Follow-Up",
    slug: "follow-up",
    description:
      "One short follow-up, two to four days later, adding a single new angle. No 'just checking in'.",
    category: "follow-up",
    order: 20,
    tokens: ["ContactName", "Company", "FounderName"],
    html: [
      "<p>Hi {{ContactName}},</p>",
      "<p>I wrote last week about automating {{Company}}’s billing and reconciliation, and thought it might have slipped through the inbox.</p>",
      "<p>One thing I didn’t mention: the setup plugs into your existing Xero workflows, so there is no migration and nothing new for your team to learn.</p>",
      "<p>Worth a look? A 10-minute screen share is enough to see if it fits.</p>",
      "<p>Best,<br/>{{FounderName}}<br/>Jonathan Simpson &amp; Co.</p>",
    ].join(""),
  },
  {
    name: "Breakup / Last Touch",
    slug: "breakup",
    description:
      "The final touch in a sequence. It honours the reader's time and leaves the door open once.",
    category: "follow-up",
    order: 30,
    tokens: ["ContactName", "Company", "FounderName"],
    html: [
      "<p>Hi {{ContactName}},</p>",
      "<p>I’ll keep this short. If {{Company}}’s accounting workload is under control, no need to reply; this is my last note on it.</p>",
      "<p>If it ever isn’t, we are one reply away.</p>",
      "<p>All the best,<br/>{{FounderName}}</p>",
    ].join(""),
  },
  {
    name: "Proposal / Intro",
    slug: "proposal-intro",
    description:
      "Follow-up after a conversation: the agreed outline, timeline, and next step.",
    category: "proposal",
    order: 40,
    tokens: ["ContactName", "Company", "ValueLine", "FounderName"],
    html: [
      "<p>Dear {{ContactName}},</p>",
      "<p>Thank you for the conversation about {{Company}}. Following up with the outline we discussed: the core scope is {{ValueLine}}, on a timeline of 4 to 6 weeks from kickoff to the first automated workflow going live.</p>",
      "<p>The next step is a 15-minute call to confirm the exact workflows and agree the rollout plan. Full background and real-world use cases are on our site at <a href=\"https://jonathansimpson.co/\">jonathansimpson.co</a>.</p>",
      "<p>Best regards,<br/>{{FounderName}}<br/>Jonathan Simpson &amp; Co.</p>",
    ].join(""),
  },
  {
    name: "Blank",
    slug: "blank",
    description: "Start from an empty message.",
    category: "blank",
    order: 100,
    tokens: [],
    html: "<p><br></p>",
  },
];

/** Idempotent seed. Upserts by slug and refreshes seeded content on every
 * run so copy improvements reach existing mailboxes. Custom templates are
 * untouched (keyed by slug). E11000 from a concurrent seed is treated as
 * success (same slug, same content). */
export async function seedTemplates(): Promise<void> {
  await connectToDatabase();
  for (const t of SEED_TEMPLATES) {
    try {
      await Template.findOneAndUpdate(
        { slug: t.slug },
        { $set: t },
        { upsert: true },
      );
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) {
        throw err;
      }
    }
  }
}
