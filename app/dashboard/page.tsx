import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongoose";
import mongoose from "mongoose";
import { Thread } from "@/models/Thread";
import { Message } from "@/models/Message";
import { ThreadList } from "@/components/dashboard/thread-list";
import { DEFAULT_SENDER_ALIAS, DEFAULT_SENDER_NAME } from "@/lib/site";
import type PageProps from "next";

export const dynamic = "force-dynamic";

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (!session) return null;

  const searchParams = await props.searchParams;
  const rawThreadId =
    typeof searchParams.thread === "string" ? searchParams.thread : null;
  const selectedThreadId =
    rawThreadId && mongoose.isValidObjectId(rawThreadId) ? rawThreadId : null;

  await connectToDatabase();

  const [threadsRaw, messagesRaw] = await Promise.all([
    Thread.find().sort({ lastMessageAt: -1 }).limit(200).lean(),
    selectedThreadId
      ? Message.find({ threadId: selectedThreadId })
          .sort({ createdAt: 1 })
          .lean()
      : [],
  ]);

  const threads = threadsRaw.map((t) => ({
    id: String(t._id),
    subject: t.subject,
    snippet: t.snippet,
    lastMessageAt: t.lastMessageAt.toISOString(),
    messageCount: t.messageCount,
    participants: t.participants,
  }));

  const messages = messagesRaw.map((m) => ({
    id: String(m._id),
    threadId: String(m.threadId),
    sender: m.sender,
    recipients: m.recipients,
    subject: m.subject,
    htmlBody: m.htmlBody ?? "",
    textBody: m.textBody ?? "",
    direction: m.direction,
    attachments: m.attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      contentId: a.contentId,
    })),
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <ThreadList
      threads={threads}
      selectedThreadId={selectedThreadId}
      userEmail={session.user.email}
      defaultFromName={
        (session.user as typeof session.user & { fromName?: string }).fromName ??
        DEFAULT_SENDER_NAME
      }
      defaultFromAlias={
        (session.user as typeof session.user & { fromAlias?: string }).fromAlias ??
        DEFAULT_SENDER_ALIAS
      }
      messages={messages}
    />
  );
}
