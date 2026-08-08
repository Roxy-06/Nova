"use client";
import type { QueuedPost } from "./types";

// Shows the actual drafted-but-not-yet-published posts, ranked the same way
// the backend will release them (best score first). This is real data from
// the queue -- not a placeholder -- so the person can see exactly what's
// coming before it goes live.
export function PendingQueue({ queue }: { queue: QueuedPost[] }) {
  if (queue.length === 0) return null;

  const [next, ...rest] = queue;

  return (
    <div className="pending-queue">
      <div className="pending-queue-head">
        <p className="eyebrow" style={{ margin: 0 }}>Up next in the queue</p>
        <span style={{ font: "10px DM Mono, monospace", color: "var(--muted)" }}>
          SCORE {next.overallScore.toFixed(1)}/10
        </span>
      </div>
      <p className="post-text" style={{ fontSize: "15px", opacity: 0.92 }}>
        {next.text.length > 320 ? next.text.slice(0, 320) + "…" : next.text}
      </p>
      {rest.length > 0 && (
        <p style={{ font: "10px DM Mono, monospace", color: "var(--muted)", margin: "10px 0 0" }}>
          + {rest.length} more waiting behind this one
        </p>
      )}
    </div>
  );
}