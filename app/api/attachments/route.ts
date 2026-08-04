import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongoose";
import mongoose from "mongoose";
import { getResend } from "@/lib/resend";
import { Message } from "@/models/Message";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lazily resolves download links for inbound message attachments
 * via the Resend receiving attachments API.
 */
export async function GET(request: Request) {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messageId = new URL(request.url).searchParams.get("messageId");
  if (!messageId || !mongoose.isValidObjectId(messageId)) {
    return Response.json({ error: "messageId required" }, { status: 400 });
  }

  await connectToDatabase();
  const message = await Message.findById(messageId)
    .select("resendEmailId direction attachments")
    .lean();

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  if (message.direction !== "inbound" || !message.resendEmailId) {
    return Response.json({ attachments: [] });
  }

  const { data, error } = await getResend().emails.receiving.attachments.list({
    emailId: message.resendEmailId,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    attachments: (data?.data ?? []).map((a) => ({
      filename: a.filename ?? a.id,
      downloadUrl: a.download_url,
    })),
  });
}
