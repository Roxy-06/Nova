"use client";
import { useEffect, useState } from "react";

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}h ${m}m ${s}s`;
}

// The backend no longer runs on a fixed interval -- it scans continuously,
// back-to-back, with only a short courtesy pause between passes. There is no
// "next loop" time to count down to, so this now shows session uptime as a
// simple heartbeat that the node has never gone to standby.
export function CountdownTimer() {
  const [elapsed, setElapsed] = useState("00h 00m 00s");
  useEffect(() => {
    const start = Date.now();
    const update = () => setElapsed(formatElapsed(Date.now() - start));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="countdown">
      <i /> CONTINUOUS SCAN LOOP // NO STANDBY <b>SESSION UPTIME: {elapsed}</b>
    </span>
  );
}