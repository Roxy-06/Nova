"use client";
import { useEffect, useState } from "react";
const LOOP_MS = 6 * 60 * 60 * 1000;
function untilNextLoop() { const left = LOOP_MS - Date.now() % LOOP_MS; return `${String(Math.floor(left / 3_600_000)).padStart(2, "0")}h ${String(Math.floor(left % 3_600_000 / 60_000)).padStart(2, "0")}m ${String(Math.floor(left % 60_000 / 1000)).padStart(2, "0")}s`; }
export function CountdownTimer() { const [remaining, setRemaining] = useState("--h --m --s"); useEffect(() => { const update = () => setRemaining(untilNextLoop()); update(); const id = setInterval(update, 1000); return () => clearInterval(id); }, []); return <span className="countdown"><i /> AUTONOMOUS ACTIVE <b>NEXT INGESTION LOOP: {remaining}</b></span>; }
