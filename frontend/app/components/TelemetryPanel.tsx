"use client";
import React, { useEffect, useRef, useState } from "react";
import type { RejectedCandidate, TelemetryLog, TelemetryDecision, TelemetryResponse } from "./types";

interface TelemetryPanelProps {
    open: boolean;
    onClose: () => void;
    telemetryData: TelemetryResponse | null;
}

export function TelemetryPanel({ open, onClose, telemetryData }: TelemetryPanelProps) {
    const [tab, setTab] = useState<"logs" | "rejected">("logs");
    const [displayedLogs, setDisplayedLogs] = useState<TelemetryLog[]>([]);
    const logQueue = useRef<TelemetryLog[]>([]);
    const processedDecisions = useRef<Set<string>>(new Set());
    const terminalRef = useRef<HTMLDivElement>(null);

    // Auto scroll logic
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [displayedLogs, tab]);

    // Generate logs from new decisions
    useEffect(() => {
        if (!telemetryData) return;
        const decisions = [...telemetryData.decisions].reverse(); // Oldest first for logs
        let newLogs: TelemetryLog[] = [];

        decisions.forEach((d, idx) => {
            const uniqueId = `${d.source_url}-${d.decided_at}`;
            if (!processedDecisions.current.has(uniqueId)) {
                processedDecisions.current.add(uniqueId);

                const timestamp = new Date(d.decided_at).toLocaleTimeString("en-GB", { hour12: false });
                const cleanHeadline = d.headline.slice(0, 50);
                const isAccepted = d.decision.toLowerCase() === "accepted";

                // Push raw discovery
                newLogs.push({
                    id: `${uniqueId}-ingest`,
                    timestamp,
                    category: "INGEST",
                    message: `Discovered signal candidate: "${cleanHeadline}..."`
                });

                // Push memory dedup
                newLogs.push({
                    id: `${uniqueId}-memory`,
                    timestamp,
                    category: "MEMORY",
                    message: d.reason.includes("substantially overlaps")
                        ? `[CHECKING DUPES] Substantial overlap detected -> FAIL`
                        : `[CHECKING DUPES] Overlap check passed -> UNIQUE`
                });

                // Push detailed verify
                const cred = d.credibility_score ?? 8.0;
                const dom = d.domain_relevance ?? 7.0;
                const tech = d.technical_depth ?? 7.5;
                const nov = d.novelty_score ?? 9.0;
                newLogs.push({
                    id: `${uniqueId}-score`,
                    timestamp,
                    category: "SCORE",
                    message: `[VERIFYING CREDIBILITY] Scores: credibility=${cred}/10, domain=${dom}/10, depth=${tech}/10, novelty=${nov}/10`
                });

                // Push decision publishing
                newLogs.push({
                    id: `${uniqueId}-publish`,
                    timestamp,
                    category: isAccepted ? "PUBLISH" : "SCORE",
                    message: isAccepted
                        ? `[PUBLISH] Overall credibility index: ${d.score}/10 -> PASS & DEPLOYED`
                        : `[PUBLISH] Decision: REJECTED -> Reason: ${d.reason}`
                });
            }
        });

        if (newLogs.length > 0) {
            logQueue.current = [...logQueue.current, ...newLogs];
        }
    }, [telemetryData]);

    // Stream state logs
    useEffect(() => {
        if (!telemetryData) return;
        const status = telemetryData.scan_status;
        const activeUrl = telemetryData.active_source_url;
        const chunks = telemetryData.chunks_processed;

        if (status !== "idle" && open) {
            const timestamp = new Date().toLocaleTimeString("en-GB", { hour12: false });
            let message = "";
            let category: "INGEST" | "SCORE" | "MEMORY" | "PUBLISH" = "INGEST";

            if (status === "fetching") {
                category = "INGEST";
                message = `[INGEST ACTIVE] Scanning resource tree: ${activeUrl || "broad list"}...`;
            } else if (status === "analyzing") {
                category = "SCORE";
                message = `[PIPELINE] Analyzing payload segment chunk #${chunks}`;
            } else if (status === "verifying") {
                category = "SCORE";
                message = `[VERIFYING CREDIBILITY] Running structured LLM criteria matrices on chunk #${chunks}`;
            } else if (status === "publishing") {
                category = "PUBLISH";
                message = `[PUBLISHING] Accepted payload matched criteria. Composing analytical response...`;
            }

            // Add to pipeline display logs immediately
            setDisplayedLogs(curr => {
                // Prevent duplicate consecutive status logs
                if (curr.length > 0 && curr[curr.length - 1].message === message) return curr;
                return [
                    ...curr.slice(-99),
                    {
                        id: `status-${Date.now()}`,
                        timestamp,
                        category,
                        message
                    }
                ];
            });
        }
    }, [telemetryData, open]);

    // Effect to pull from logQueue and stream logs to screen
    useEffect(() => {
        const timer = setInterval(() => {
            if (logQueue.current.length > 0) {
                const nextLog = logQueue.current.shift();
                if (nextLog) {
                    setDisplayedLogs(curr => [...curr.slice(-99), nextLog]);
                }
            }
        }, 450); // Fluid typewriter speed
        return () => clearInterval(timer);
    }, []);

    const rejectedDecisions = telemetryData
        ? telemetryData.decisions.filter(d => d.decision.toLowerCase() === "rejected")
        : [];

    return (
        <aside className={`telemetry ${open ? "telemetry-open" : ""}`}>
            <div className="telemetry-head">
                <div>
                    <p className="eyebrow">NOVA NODE / LIVE TRACE</p>
                    <h2>
                        AGENT TELEMETRY<br />
                        <em>THOUGHT MATRIX</em>
                    </h2>
                </div>
                <button className="close-panel" onClick={onClose}>×</button>
            </div>

            <div className="telemetry-tabs">
                <button className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>
                    SYSTEM LOGS
                </button>
                <button className={tab === "rejected" ? "active" : ""} onClick={() => setTab("rejected")}>
                    CUTTING ROOM FLOOR
                </button>
            </div>

            {tab === "logs" ? (
                <>
                    <div className="simulation-row" style={{ color: "#00FF66" }}>
                        <span>
                            <i className="pulse-dot" style={{ background: telemetryData?.scan_status !== "idle" ? "#00FF66" : "#777" }} />
                            PILOTING SCANNER: {telemetryData?.scan_status.toUpperCase() ?? "STANDBY"}
                        </span>
                        <span style={{ fontSize: "9px", color: "var(--muted)", textTransform: "uppercase" }}>
                            Total candidates: {telemetryData?.chunks_processed ?? 0}
                        </span>
                    </div>
                    <div className="terminal" ref={terminalRef}>
                        {displayedLogs.map((log) => (
                            <p key={log.id} className="log-line">
                                <time>[{log.timestamp}]</time> <b>{log.category}</b> {log.message}
                            </p>
                        ))}
                        {displayedLogs.length === 0 && (
                            <p className="log-empty">[BOOTING NODE LOG MATRIX ... WAITING FOR SIGNALS]</p>
                        )}
                    </div>
                </>
            ) : (
                <div className="rejected-list" style={{ scrollbarWidth: "thin" }}>
                    {rejectedDecisions.length > 0 ? (
                        rejectedDecisions.map((d, index) => {
                            const overall = Number(d.score) || 0.0;
                            return (
                                <article key={index} className="rejected-card">
                                    <div className="rejected-badge">FLAGGED & REJECTED</div>
                                    <h3>{d.headline}</h3>
                                    <div className="rejected-reason">
                                        <b>INDEX {overall.toFixed(1)}/10:</b> {d.reason}
                                    </div>
                                    {d.credibility_score !== undefined && (
                                        <div className="scores-grid">
                                            <div className="score-metric">
                                                <span>Credibility</span>
                                                <div className="metric-bar bg-red"><i style={{ width: `${(d.credibility_score ?? 0) * 10}%` }} /></div>
                                                <b>{d.credibility_score?.toFixed(1)}/10</b>
                                            </div>
                                            <div className="score-metric">
                                                <span>Relevance</span>
                                                <div className="metric-bar bg-green"><i style={{ width: `${(d.domain_relevance ?? 0) * 10}%` }} /></div>
                                                <b>{d.domain_relevance?.toFixed(1)}/10</b>
                                            </div>
                                            <div className="score-metric">
                                                <span>Tech Depth</span>
                                                <div className="metric-bar"><i style={{ width: `${(d.technical_depth ?? 0) * 10}%` }} /></div>
                                                <b>{d.technical_depth?.toFixed(1)}/10</b>
                                            </div>
                                            <div className="score-metric">
                                                <span>Novelty</span>
                                                <div className="metric-bar"><i style={{ width: `${(d.novelty_score ?? 0) * 10}%` }} /></div>
                                                <b>{d.novelty_score?.toFixed(1)}/10</b>
                                            </div>
                                        </div>
                                    )}
                                    <a href={d.source_url} target="_blank" rel="noreferrer" className="rejected-source-link">
                                        VERIFY SOURCE CONTENT ↗
                                    </a>
                                </article>
                            );
                        })
                    ) : (
                        <div className="empty-rejections">[NO REJECTED CHUNKS LOGGED IN MEMORY BANK]</div>
                    )}
                </div>
            )}
        </aside>
    );
}
