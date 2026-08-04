"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ThreadReader } from "@/components/dashboard/thread-reader";
import { formatRelativeTime } from "@/lib/format";

export interface ThreadListItem {
  id: string;
  subject: string;
  snippet: string;
  lastMessageAt: string;
  messageCount: number;
  participants: string[];
}

export interface ReaderMessage {
  id: string;
  threadId: string;
  sender: { name?: string; email: string };
  recipients: string[];
  subject: string;
  htmlBody: string;
  textBody: string;
  direction: "inbound" | "outbound";
  attachments: { filename: string; contentType?: string; contentId?: string }[];
  createdAt: string;
}

export function ThreadList({
  threads,
  selectedThreadId,
  userEmail,
  messages,
}: {
  threads: ThreadListItem[];
  selectedThreadId: string | null;
  userEmail: string;
  messages: ReaderMessage[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Poll for new mail every 30s
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(interval);
  }, [router]);

  const filtered = threads.filter((t) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      t.subject.toLowerCase().includes(q) ||
      t.snippet.toLowerCase().includes(q) ||
      t.participants.some((p) => p.toLowerCase().includes(q))
    );
  });

  const selected = threads.find((t) => t.id === selectedThreadId) ?? null;

  return (
    <div className="mx-auto grid w-full max-w-[1400px] flex-1 gap-px bg-line lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* Thread rail */}
      <aside className="flex min-h-0 flex-col border-b border-line bg-cream lg:h-[calc(100dvh-3.5rem)] lg:border-b-0">
        <div className="border-b border-line p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="eyebrow">Inbox</h2>
            <span className="font-mono text-[0.68rem] text-muted">
              {threads.length} THREADS
            </span>
          </div>
          <input
            type="search"
            aria-label="Search threads"
            placeholder="Search threads, senders…"
            className="input !rounded-md !py-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <ul className="flex-1 divide-y divide-line overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-10 text-center">
              <p className="text-xs text-muted">
                {query ? "No threads match your search." : "No mail yet."}
              </p>
            </li>
          ) : (
            filtered.map((thread) => {
              const active = thread.id === selectedThreadId;
              return (
                <li key={thread.id}>
                  <button
                    onClick={() =>
                      router.push(active ? "/dashboard" : `/dashboard?thread=${thread.id}`)
                    }
                    className={`w-full px-4 py-3.5 text-left transition-colors duration-[220ms] ${
                      active ? "bg-sage-soft" : "hover:bg-sage-soft/50"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`font-mono text-[0.72rem] tracking-[0.1em] ${
                          active ? "text-sage-text" : "text-muted"
                        }`}
                      >
                        {thread.messageCount} MSG
                      </span>
                      <span className="ml-auto font-mono text-[0.72rem] tracking-[0.05em] text-muted">
                        {formatRelativeTime(thread.lastMessageAt)}
                      </span>
                    </div>
                    <p className="truncate text-[0.85rem] font-medium text-ink">
                      {thread.subject}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {thread.snippet || thread.participants.join(", ")}
                    </p>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      {/* Reader pane */}
      <section className="min-h-0 bg-cream lg:h-[calc(100dvh-3.5rem)]">
        {selected && messages.length > 0 ? (
          <ThreadReader
            thread={selected}
            messages={messages}
            userEmail={userEmail}
          />
        ) : selected ? (
          <EmptyState
            title={selected.subject}
            body="No messages in this thread yet."
          />
        ) : (
          <EmptyState
            title="MetroMail"
            body="Select a thread from the rail to read it, or compose new mail."
            ctaHref="/dashboard/compose"
            ctaLabel="Compose"
          />
        )}
      </section>
    </div>
  );
}

function EmptyState({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const router = useRouter();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-serif text-2xl text-ink">{title}</p>
      <p className="max-w-sm text-sm text-muted">{body}</p>
      {ctaHref && ctaLabel ? (
        <button onClick={() => router.push(ctaHref)} className="btn btn--solid btn--small">
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}
