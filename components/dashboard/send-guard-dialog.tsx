"use client";

import { useEffect, useRef } from "react";

export interface SendGuardDialogProps {
  open: boolean;
  sentToday: number;
  dailyLimit: number;
  coldCeiling: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog shown when today's send volume approaches the daily
 * limit or exceeds the cold-outreach ceiling. Native <dialog> so Esc, focus
 * containment and backdrop behaviour come from the platform.
 */
export function SendGuardDialog({
  open,
  sentToday,
  dailyLimit,
  coldCeiling,
  onConfirm,
  onCancel,
}: SendGuardDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);
  const percent = dailyLimit > 0 ? Math.round((sentToday / dailyLimit) * 100) : 0;
  const overCeiling = coldCeiling > 0 && sentToday >= coldCeiling;

  return (
    <dialog
      ref={ref}
      className="send-guard"
      aria-labelledby="send-guard-title"
      onClose={onCancel}
    >
      <div className="p-6">
        <p className="eyebrow mb-2">Send Guard</p>
        <h2 id="send-guard-title" className="font-serif text-xl text-ink">
          Volume check
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {"You've"} sent {sentToday} emails today, {percent}% of your {dailyLimit} daily limit
          {overCeiling
            ? `, past the ${coldCeiling}-per-day cold-outreach ceiling`
            : ""}.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Continue with this message?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Not now
          </button>
          <button type="button" className="btn btn--solid" onClick={onConfirm}>
            Send anyway
          </button>
        </div>
      </div>
    </dialog>
  );
}
