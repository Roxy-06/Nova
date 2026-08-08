"use client";
import { useEffect, useState } from "react";

function formatRemaining(ms: number) {
  if (ms <= 0) return "any moment now";
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

// Ticks down to the backend's real Agent.next_publish_at -- this is an
// actual scheduled time from the publish queue, not a fixed/fake interval.
// If nextPublishAt is null (nothing has ever been queued yet), shows a
// waiting state instead of a countdown to nothing.
export function CountdownTimer({ nextPublishAt, queueSize }: { nextPublishAt: string | null; queueSize: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!nextPublishAt) {
    return (
      <span className="countdown">
        <i /> WAITING ON FIRST QUALIFYING SIGNAL
      </span>
    );
  }

  const remainingMs = new Date(nextPublishAt).getTime() - now;
  return (
    <span className="countdown">
      <i /> NEXT TRANSMISSION IN <b>{formatRemaining(remainingMs)}</b>
      {queueSize > 0 && <span style={{ marginLeft: 8, color: "var(--muted)" }}>({queueSize} queued)</span>}
    </span>
  );
}