import { headers } from "next/headers";
import mongoose from "mongoose";
import { getAuth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongoose";
import { Prospect, type ProspectStatus } from "@/models/Prospect";
import { EMAIL_RE } from "@/lib/email-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: ProspectStatus[] = ["draft", "sent", "replied", "skipped"];

const FIELD_LIMITS = {
  name: 120,
  company: 160,
  email: 320,
  role: 200,
  listing: 5_000,
  notes: 2_000,
  context: 2_000,
  valueLine: 500,
} as const;

async function requireSession() {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  return session;
}

function cleanField(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim()
    .slice(0, max);
}

interface ProspectInput {
  name?: string;
  company?: string;
  email?: string;
  role?: string;
  listing?: string;
  notes?: string;
  context?: string;
  valueLine?: string;
  status?: string;
}

function validateInput(body: ProspectInput): {
  error?: string;
  prospect?: {
    name: string;
    company: string;
    email: string;
    role: string;
    listing: string;
    notes: string;
    context: string;
    valueLine: string;
  };
} {
  const name = cleanField(body.name, FIELD_LIMITS.name);
  const email = cleanField(body.email, FIELD_LIMITS.email).toLowerCase();
  if (!name || !EMAIL_RE.test(email)) {
    return { error: "Each prospect needs a name and a valid email." };
  }
  return {
    prospect: {
      name,
      company: cleanField(body.company, FIELD_LIMITS.company),
      email,
      role: cleanField(body.role, FIELD_LIMITS.role),
      listing: cleanField(body.listing, FIELD_LIMITS.listing),
      notes: cleanField(body.notes, FIELD_LIMITS.notes),
      context: cleanField(body.context, FIELD_LIMITS.context),
      valueLine: cleanField(body.valueLine, FIELD_LIMITS.valueLine),
    },
  };
}

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  await connectToDatabase();
  const prospects = await Prospect.find().sort({ createdAt: -1 }).lean();
  return Response.json({ prospects });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await connectToDatabase();

  // Single prospect or a batch of them (CSV-style rows).
  const rows: unknown[] = Array.isArray(body) ? body : [body];
  if (rows.length === 0 || rows.length > 200) {
    return Response.json(
      { error: "Provide between 1 and 200 prospects per request." },
      { status: 400 },
    );
  }

  let createdCount = 0;
  const skipped: { email?: string; reason: string }[] = [];

  // Single prospect, or a batch of them. Batch imports use bulkWrite with
  // upserts keyed on the (unique) email. Race-safe and one round trip.
  if (rows.length === 1) {
    const row = rows[0];
    if (!row || typeof row !== "object") {
      skipped.push({ reason: "Malformed row." });
    } else {
      const result = validateInput(row as ProspectInput);
      if (result.error || !result.prospect) {
        skipped.push({ reason: result.error ?? "Malformed row." });
      } else {
        try {
          await Prospect.create(result.prospect);
          createdCount += 1;
        } catch (err) {
          if ((err as { code?: number }).code === 11000) {
            skipped.push({ email: result.prospect.email, reason: "Already added." });
          } else {
            throw err;
          }
        }
      }
    }
  } else {
    const ops: Parameters<typeof Prospect.bulkWrite>[0] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") {
        skipped.push({ reason: "Malformed row." });
        continue;
      }
      const result = validateInput(row as ProspectInput);
      if (result.error || !result.prospect) {
        skipped.push({ reason: result.error ?? "Malformed row." });
        continue;
      }
      ops.push({
        updateOne: {
          filter: { email: result.prospect.email },
          update: { $setOnInsert: result.prospect },
          upsert: true,
        },
      });
    }
    if (ops.length > 0) {
      const result = await Prospect.bulkWrite(ops, { ordered: false });
      createdCount += result.upsertedCount;
      for (let i = 0; i < result.matchedCount; i += 1) {
        skipped.push({ reason: "Already added." });
      }
    }
  }

  return Response.json({ created: createdCount, skipped }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: { id?: string; status?: string; sentAt?: string; threadId?: string } & ProspectInput;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id || !mongoose.isValidObjectId(body.id)) {
    return Response.json({ error: "Invalid prospect id." }, { status: 400 });
  }

  await connectToDatabase();

  const update: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as ProspectStatus)) {
      return Response.json({ error: "Invalid status." }, { status: 400 });
    }
    update.status = body.status;
    if (body.status === "sent" && !update.sentAt) {
      update.sentAt = new Date();
    }
  }
  if (body.sentAt !== undefined) {
    if (typeof body.sentAt !== "string" || Number.isNaN(Date.parse(body.sentAt))) {
      return Response.json({ error: "Invalid sentAt date." }, { status: 400 });
    }
    update.sentAt = new Date(body.sentAt);
  }
  if (typeof body.threadId === "string") {
    update.threadId = body.threadId.slice(0, 64);
  }
  if (body.email !== undefined) {
    const email = cleanField(body.email, FIELD_LIMITS.email).toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: "Invalid email address." }, { status: 400 });
    }
    update.email = email;
  }
  for (const field of [
    "name",
    "company",
    "role",
    "listing",
    "notes",
    "context",
    "valueLine",
  ] as const) {
    if (body[field] !== undefined) {
      update[field] = cleanField(body[field], FIELD_LIMITS[field]);
    }
  }

  try {
    const updated = await Prospect.findByIdAndUpdate(
      body.id,
      { $set: update },
      { new: true },
    ).lean();
    if (!updated) {
      return Response.json({ error: "Prospect not found." }, { status: 404 });
    }
    return Response.json({ prospect: updated });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return Response.json(
        { error: "Another prospect already uses that email." },
        { status: 409 },
      );
    }
    throw err;
  }
}

export async function DELETE(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !mongoose.isValidObjectId(id)) {
    return Response.json({ error: "Invalid prospect id." }, { status: 400 });
  }

  await connectToDatabase();
  const deleted = await Prospect.findByIdAndDelete(id);
  if (!deleted) {
    return Response.json({ error: "Prospect not found." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
