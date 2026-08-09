"use client";
import { useEffect, useState } from "react";

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

type Props = {
  // ISO timestamp of the agent's next scheduled automatic publish, or null
  // if nothing is queued yet. Comes straight from the backend
  // (Agent.next_publish_at) -- never computed/guessed on the frontend, so a
  // manual "Publish now" click (which resets this on the backend) is
  // reflected here on the very next telemetry poll.
  nextPublishAt: string | null;
  queueSize: number;
};

// Scanning itself never stops or goes on standby -- only the PUBLISH side
// is timed. This shows a live countdown to the next automatic release when
// something is queued, and an honest "nothing queued yet" state otherwise,
// instead of a fake fixed interval.
export function CountdownTimer({ nextPublishAt, queueSize }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  let statusLabel: string;
  if (queueSize === 0) {
    statusLabel = "QUEUE EMPTY — SCANNING FOR CANDIDATES";
  } else if (!nextPublishAt) {
    statusLabel = "READY TO PUBLISH";
  } else {
    const remainingMs = new Date(nextPublishAt).getTime() - now;
    statusLabel = remainingMs <= 0
      ? "PUBLISHING NOW…"
      : `NEXT AUTO-PUBLISH IN ${formatRemaining(remainingMs)}`;
  }

  return (
    <span className="countdown">
      <i /> CONTINUOUS SCAN LOOP // NO STANDBY <b>{statusLabel}</b>
    </span>
  );
}