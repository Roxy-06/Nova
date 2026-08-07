"use client";
import { useEffect, useRef, useState } from "react";
import type { RejectedCandidate, TelemetryLog, TelemetryDecision } from "./types";

const fallbackRejected: RejectedCandidate[] = [
    { id: "r1", title: "Generic Python tutorial promises instant AI productivity", score: 3, reason: "Generic tutorial; outside NOVA's frontier technology domain." },
    { id: "r2", title: "New model launch repeats yesterday's benchmark claims", score: 4, reason: "88% semantic overlap with a post evaluated in the past 12 hours." },
    { id: "r3", title: "Consumer gadget roundup", score: 2, reason: "Promotional coverage with no durable operational implication." }
];

const initialLogs: TelemetryLog[] = [
    { id: "l1", timestamp: "22:01:04", category: "INGEST", message: "RSS Loop: Ingested 14 candidates from primary technology feeds" },
    { id: "l2", timestamp: "22:01:08", category: "SCORE", message: "Persona Engine: Evaluated candidate → Match Score: 92/100" },
    { id: "l3", timestamp: "22:01:10", category: "MEMORY", message: "Vector Memory: Deduplication passed (99.4% unique vs. past 48h posts)" },
    { id: "l4", timestamp: "22:01:12", category: "PUBLISH", message: "Pipeline: Post published successfully to Feed" }
];

const rotating = [
    "Source verifier: canonical URL confirmed",
    "Persona Engine: impact analysis attached",
    "Memory layer: prior narrative link identified",
    "RSS Loop: source freshness window passed"
];

export function TelemetryPanel({ agentId, open, onClose }: { agentId?: string; open: boolean; onClose(): void }) {
    const [tab, setTab] = useState<"logs" | "rejected">("logs");
    const [simulating, setSimulating] = useState(true);
    const [logs, setLogs] = useState<TelemetryLog[]>(initialLogs);
    const [decisions, setDecisions] = useState<TelemetryDecision[]>([]);
    const terminal = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (terminal.current) terminal.current.scrollTop = terminal.current.scrollHeight;
    }, [logs, tab]);

    useEffect(() => {
        if (!simulating) return;
        const id = setInterval(() => {
            setLogs(current => [
                ...current.slice(-17),
                {
                    id: crypto.randomUUID(),
                    timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
                    category: ["INGEST", "SCORE", "MEMORY"][Math.floor(Math.random() * 3)] as TelemetryLog["category"],
                    message: rotating[Math.floor(Math.random() * rotating.length)]
                }
            ]);
        }, 3600);
        return () => clearInterval(id);
    }, [simulating]);

    useEffect(() => {
        if (!open || !agentId) return;
        const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        let active = true;

        async function fetchTelemetry() {
            try {
                const response = await fetch(`${API}/api/agent/telemetry?agentId=${agentId}`);
                if (response.ok && active) {
                    const data = await response.json();
                    setDecisions(data);
                }
            } catch (err) {
                console.error("Failed to fetch telemetry", err);
            }
        }

        fetchTelemetry();
        const intervalId = setInterval(fetchTelemetry, 10000);
        return () => {
            active = false;
            clearInterval(intervalId);
        };
    }, [open, agentId]);

    const rejectedDecisions = decisions.filter(d => d.decision.toLowerCase() === "rejected");
    const displayRejected = rejectedDecisions.length > 0
        ? rejectedDecisions.map((d, index) => ({
            id: d.source_url + index,
            title: d.headline,
            reason: d.reason,
            score: isNaN(Number(d.score)) ? 0 : Number(d.score)
        }))
        : fallbackRejected;

    return (
        <aside className={`telemetry ${open ? "telemetry-open" : ""}`}>
            <div className="telemetry-head">
                <div>
                    <p className="eyebrow">NOVA NODE / LIVE TRACE</p>
                    <h2>AGENT TELEMETRY<br /><em>THOUGHT MATRIX</em></h2>
                </div>
                <button className="close-panel" onClick={onClose}>×</button>
            </div>

            <div className="telemetry-tabs">
                <button className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>SYSTEM LOGS</button>
                <button className={tab === "rejected" ? "active" : ""} onClick={() => setTab("rejected")}>CUTTING ROOM FLOOR</button>
            </div>

            {tab === "logs" ? (
                <>
                    <div className="simulation-row">
                        <span><i /> LIVE STREAM</span>
                        <button onClick={() => setSimulating(v => !v)}>
                            {simulating ? "PAUSE SIMULATION" : "RESUME SIMULATION"}
                        </button>
                    </div>
                    <div className="terminal" ref={terminal}>
                        {logs.map(log => (
                            <p key={log.id}>
                                <time>[{log.timestamp}]</time> <b>{log.category}</b> {log.message}
                            </p>
                        ))}
                    </div>
                </>
            ) : (
                <div className="rejected-list">
                    {displayRejected.map(item => (
                        <article key={item.id}>
                            <span>REJECTED BY EDITORIAL RULE</span>
                            <h3>{item.title}</h3>
                            <p><b>SCORE {item.score}/10:</b> {item.reason}</p>
                        </article>
                    ))}
                </div>
            )}
        </aside>
    );
}
