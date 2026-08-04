import { headers } from "next/headers";
import mongoose from "mongoose";
import { getAuth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongoose";
import { Template, type ITemplate } from "@/models/Template";
import { seedTemplates } from "@/lib/seed-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TemplateBody {
  name?: string;
  description?: string;
  category?: string;
  html?: string;
  tokens?: string[];
}

async function requireSession() {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  return session;
}

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  if ((await Template.countDocuments()) === 0) {
    await seedTemplates();
  }

  const templates = await Template.find()
    .sort({ order: 1 })
    .select("name slug description category html tokens order")
    .lean();
  return Response.json({ templates });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: TemplateBody;
  try {
    body = (await request.json()) as TemplateBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  const html = body.html?.trim();
  if (!name || !html) {
    return Response.json(
      { error: "A template needs a name and an HTML body." },
      { status: 400 },
    );
  }
  if (name.length > 80 || Buffer.byteLength(html, "utf8") > 50_000) {
    return Response.json({ error: "Template too large." }, { status: 400 });
  }

  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || `template-${crypto.randomUUID().slice(0, 8)}`;

  const count = await Template.countDocuments();

  const validCategories: ITemplate["category"][] = [
    "cold-outreach",
    "follow-up",
    "proposal",
    "internal",
    "blank",
  ];
  const category = validCategories.includes(body.category as ITemplate["category"])
    ? (body.category as ITemplate["category"])
    : "internal";

  const tokens = Array.isArray(body.tokens)
    ? [...new Set(
        body.tokens
          .map(String)
          .map((t) => t.trim())
          .filter((t) => /^[A-Za-z0-9_ .-]{1,64}$/.test(t)),
      )].slice(0, 20)
    : [];

  try {
    const created = await Template.create({
      name,
      slug,
      description: body.description?.trim() ?? "",
      category,
      html,
      tokens,
      order: count + 1,
    });

    return Response.json({ template: created }, { status: 201 });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return Response.json(
        { error: "A template with this name already exists." },
        { status: 409 },
      );
    }
    throw err;
  }
}

export async function DELETE(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !mongoose.isValidObjectId(id)) {
    return Response.json({ error: "Missing or invalid template id." }, { status: 400 });
  }

  const deleted = await Template.findByIdAndDelete(id);
  if (!deleted) {
    return Response.json({ error: "Template not found." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
