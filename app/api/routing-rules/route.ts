import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongoose";
import { RoutingRule } from "@/models/RoutingRule";
import { EMAIL_RE } from "@/lib/email-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireSession() {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  return session;
}

function cleanPayload(body: {
  alias?: string;
  forwardTo?: string[];
  active?: boolean;
}) {
  const alias = body.alias?.trim().toLowerCase() ?? "";
  if (!alias || alias.length > 254) {
    return { error: "Alias is required (max 254 chars)." };
  }
  const forwardTo = [...new Set((body.forwardTo ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (forwardTo.length === 0) {
    return { error: "Add at least one destination address." };
  }
  if (forwardTo.some((e) => !EMAIL_RE.test(e))) {
    return { error: "One or more destination addresses are invalid." };
  }
  return { alias, forwardTo, active: body.active ?? true };
}

export async function GET() {
  const session = await requireSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();
  const rules = await RoutingRule.find().sort({ createdAt: 1 }).lean();

  return Response.json({
    rules: rules.map((r) => ({
      id: String(r._id),
      alias: r.alias,
      forwardTo: r.forwardTo,
      active: r.active,
    })),
  });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid body" }, { status: 400 });

  const cleaned = cleanPayload(body);
  if ("error" in cleaned) {
    return Response.json({ error: cleaned.error }, { status: 400 });
  }

  await connectToDatabase();

  const existing = await RoutingRule.findOne({ alias: cleaned.alias }).lean();
  if (existing) {
    return Response.json({ error: "A rule for this alias already exists." }, { status: 409 });
  }

  const rule = await RoutingRule.create(cleaned);
  return Response.json(
    { rule: { id: String(rule._id), ...cleaned } },
    { status: 201 },
  );
}

export async function PUT(request: Request) {
  const session = await requireSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.id) return Response.json({ error: "Rule id required" }, { status: 400 });

  const cleaned = cleanPayload(body);
  if ("error" in cleaned) {
    return Response.json({ error: cleaned.error }, { status: 400 });
  }

  await connectToDatabase();

  const conflict = await RoutingRule.findOne({
    alias: cleaned.alias,
    _id: { $ne: body.id },
  }).lean();
  if (conflict) {
    return Response.json({ error: "A rule for this alias already exists." }, { status: 409 });
  }

  const rule = await RoutingRule.findByIdAndUpdate(
    body.id,
    { $set: cleaned },
    { new: true, runValidators: true },
  ).lean();

  if (!rule) return Response.json({ error: "Rule not found" }, { status: 404 });

  return Response.json({
    rule: {
      id: String(rule._id),
      alias: rule.alias,
      forwardTo: rule.forwardTo,
      active: rule.active,
    },
  });
}

export async function DELETE(request: Request) {
  const session = await requireSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.id) return Response.json({ error: "Rule id required" }, { status: 400 });

  await connectToDatabase();
  await RoutingRule.findByIdAndDelete(body.id);
  return Response.json({ ok: true });
}
