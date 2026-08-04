import { connectToDatabase } from "@/lib/mongoose";
import { Template, type ITemplate } from "@/models/Template";

/**
 * Cold-email starter pack - content follows the cold-email skill playbook
 * (observation → problem → value → proof → low-friction ask) and the WYND
 * outreach example. Tokens like {{Company}} are replaced per-prospect in
 * the Campaign workspace; MetroEmailLayout adds the logo + site footer
 * server-side on every send.
 */
const SEED_TEMPLATES: Omit<ITemplate, "createdAt" | "updatedAt">[] = [
  {
    name: "Cold Outreach",
    slug: "cold-outreach",
    description:
      "Personalised first touch: observation, problem, value, proof, one low-friction ask.",
    category: "cold-outreach",
    order: 10,
    tokens: [
      "ContactName",
      "Company",
      "ContextLine",
      "ListingTitle",
      "ValueLine",
      "FounderName",
      "CoFounderName",
    ],
    html: [
      "<p>Dear {{ContactName}} &amp; Leadership Team at {{Company}},</p>",
      "<p>Congratulations on {{Company}}’s continued success as {{ContextLine}}. Fostering a collaborative ecosystem for entrepreneurs and growing businesses requires smooth, hassle-free daily operations.</p>",
      "<p>We noticed your listing for {{ListingTitle}} to manage membership billings, handle Xero cloud accounting, reconcile accounts, and generate regular financial reports.</p>",
      "<p>For a fast-growing community space, handling membership invoicing, Xero data syncs, and manual reconciliation on an hourly basis can cause billing delays and bookkeeping backlogs. Rather than spending time recruiting and supervising part-time staff for manual data entry, we are writing from jonathansimpson.co to offer a turn-key solution: {{ValueLine}}.</p>",
      "<h2>Custom AI &amp; Automation Tools for Xero &amp; Accounting</h2>",
      "<p>Our software architectures directly automate the core accounting and administrative responsibilities outlined in your listing, providing powerful tools to assist your operational team:</p>",
      "<ul><li><strong>Automated Xero Invoicing &amp; Membership Billings:</strong> Custom API pipelines that sync member sign-ups, plan renewals, and add-on services directly with Xero, auto-generating recurring invoices and payment reminders.</li><li><strong>Bank &amp; Account Reconciliation AI Tools:</strong> Automated tools that match incoming bank payments against open invoices in Xero, flagging discrepancies instantly and eliminating manual spreadsheet tracking.</li><li><strong>Automated Financial Reporting &amp; Dashboard:</strong> Instant compilation of monthly revenue, membership churn, and outstanding AR reports without manual data compilation.</li></ul>",
      "<h2>Data Privacy &amp; Zero Data Retention (ZDR) Compliance</h2>",
      "<p>Handling member billing records, payment details, and Xero accounting ledgers requires strict privacy protection. {{FounderName}} engineers all our systems under strict Zero Data Retention (ZDR) protocols and Hong Kong Personal Data (Privacy) Ordinance (PDPO) standards. Your records are never saved, stored, or used for model training.</p>",
      "<h2>Why Partner with jonathansimpson.co?</h2>",
      "<ul><li><strong>Zero Onboarding &amp; 24/7 Accuracy:</strong> Eliminate shift constraints and supervisor overhead while obtaining 24/7 automated billing and reconciliation.</li><li><strong>Seamless Xero Integration:</strong> Built directly around {{Company}}’s existing Xero setup and membership workflow.</li><li><strong>Concrete ROI Analysis:</strong> Calculations showing how automated pipelines execute 24/7 at a fraction of part-time hiring and supervisory costs.</li></ul>",
      "<p>To see how we design custom AI pipelines aligned with SFC, HKMA, and PDPC / PDPO compliance frameworks, visit our dedicated automation portal at <a href=\"https://automation.jonathansimpson.co/\">automation.jonathansimpson.co</a>.</p>",
      "<p>We would welcome a brief 15-minute call or virtual demo to show how we can automate {{Company}}’s accounting, Xero reconciliation, and membership billing workflows.</p>",
      "<p>Best regards,<br/>{{FounderName}} &amp; {{CoFounderName}}<br/>Co-Founders, jonathansimpson.co</p>",
    ].join(""),
  },
  {
    name: "Follow-Up",
    slug: "follow-up",
    description:
      "One short follow-up, 2–4 days later, adding a single new angle. No 'just checking in'.",
    category: "follow-up",
    order: 20,
    tokens: ["ContactName", "Company", "FounderName"],
    html: [
      "<p>Hi {{ContactName}},</p>",
      "<p>I wrote last week about automating {{Company}}’s billing and reconciliation. Thought it might have slipped through the inbox.</p>",
      "<p>One thing I didn’t mention: the setup is built around your existing Xero workflows, so there is no migration and no new tool for your team to learn.</p>",
      "<p>Worth a look? A 10-minute screen share is enough to see if it fits.</p>",
      "<p>Best,<br/>{{FounderName}}<br/>jonathansimpson.co</p>",
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
      "<p>I’ll keep this short. If {{Company}}’s accounting workload is under control, no need to reply. This is my last note on it.</p>",
      "<p>If it ever isn’t, the automation portal is at <a href=\"https://automation.jonathansimpson.co/\">automation.jonathansimpson.co</a>, and we are one reply away.</p>",
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
    tokens: ["ContactName", "Company", "ValueLine", "FounderName", "CoFounderName"],
    html: [
      "<p>Dear {{ContactName}},</p>",
      "<p>Thank you for the conversation about {{Company}}. Following up with the proposal outline we discussed:</p>",
      "<ul><li><strong>Scope:</strong> {{ValueLine}}</li><li><strong>Timeline:</strong> 4–6 weeks from kickoff to the first automated workflow live.</li><li><strong>Next step:</strong> A 15-minute call to confirm the exact workflows and agree the rollout plan.</li></ul>",
      "<p>Full background, including real-world use cases and ROI analysis, is on our main site at <a href=\"https://jonathansimpson.co/\">jonathansimpson.co</a>.</p>",
      "<p>Best regards,<br/>{{FounderName}} &amp; {{CoFounderName}}<br/>Co-Founders, jonathansimpson.co</p>",
    ].join(""),
  },
  {
    name: "Blank",
    slug: "blank",
    description: "Start from an empty branded message.",
    category: "blank",
    order: 100,
    tokens: [],
    html: "<p><br></p>",
  },
];

/** Idempotent seed. Upserts by slug, never duplicates. E11000 from a
 * concurrent seed is treated as success (same slug, same content). */
export async function seedTemplates(): Promise<void> {
  await connectToDatabase();
  for (const t of SEED_TEMPLATES) {
    try {
      await Template.findOneAndUpdate(
        { slug: t.slug },
        { $setOnInsert: t },
        { upsert: true },
      );
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) {
        throw err;
      }
    }
  }
}
