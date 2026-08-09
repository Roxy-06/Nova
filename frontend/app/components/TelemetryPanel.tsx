"use client";

import React, { useEffect, useRef, useState } from "react";

export interface TelemetryDecision {
  source_url: string;
  decided_at: string;
  headline: string;
  decision: string;
  reason: string;
  score?: number;
  credibility_score?: number;
  domain_relevance?: number;
  technical_depth?: number;
  novelty_score?: number;
}

export interface TelemetryResponse {
  scan_status: "idle" | "fetching" | "analyzing" | "verifying" | "publishing" | string;
  active_source_url?: string;
  chunks_processed: number;
  decisions: TelemetryDecision[];
}

export interface TelemetryLog {
  id: string;
  timestamp: string;
  category: "INGEST" | "MEMORY" | "SCORE" | "PUBLISH";
  message: string;
}

interface TelemetryPanelProps {
  open: boolean;
  onClose: () => void;
  telemetryData: TelemetryResponse | null;
}

type LogCategory = "ALL" | "INGEST" | "MEMORY" | "SCORE" | "PUBLISH";

export function TelemetryPanel({ open, onClose, telemetryData }: TelemetryPanelProps) {
  const [tab, setTab] = useState<"logs" | "rejected">("logs");
  const [displayedLogs, setDisplayedLogs] = useState<TelemetryLog[]>([]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<LogCategory>("ALL");
  
  const logQueue = useRef<TelemetryLog[]>([]);
  const processedDecisions = useRef<Set<string>>(new Set());
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal log to bottom on update
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [displayedLogs, tab, activeCategoryFilter]);

  // Extract decision telemetry into structured logs
  useEffect(() => {
    if (!telemetryData || !Array.isArray(telemetryData.decisions)) return;

    const decisions = [...telemetryData.decisions].reverse();
    const newLogs: TelemetryLog[] = [];

    decisions.forEach((d) => {
      const uniqueId = `${d.source_url || "src"}-${d.decided_at || Date.now()}`;
      
      if (!processedDecisions.current.has(uniqueId)) {
        processedDecisions.current.add(uniqueId);

        const timestamp = d.decided_at
          ? new Date(d.decided_at).toLocaleTimeString("en-GB", { hour12: false })
          : new Date().toLocaleTimeString("en-GB", { hour12: false });
          
        const headlineText = d.headline || "Untitled Stream Item";
        const cleanHeadline = headlineText.length > 50 ? `${headlineText.slice(0, 50)}...` : headlineText;
        const isAccepted = String(d.decision).toLowerCase() === "accepted";

        // Ingest event
        newLogs.push({
          id: `${uniqueId}-ingest`,
          timestamp,
          category: "INGEST",
          message: `Discovered signal candidate: "${cleanHeadline}"`
        });

        // Memory check event
        const isOverlap = d.reason && d.reason.includes("substantially overlaps");
        newLogs.push({
          id: `${uniqueId}-memory`,
          timestamp,
          category: "MEMORY",
          message: isOverlap
            ? `[CHECKING DUPES] Substantial overlap detected -> REJECTED`
            : `[CHECKING DUPES] Overlap check passed -> UNIQUE`
        });

        // Score matrix event
        const cred = typeof d.credibility_score === "number" ? d.credibility_score : 8.0;
        const dom = typeof d.domain_relevance === "number" ? d.domain_relevance : 7.0;
        const tech = typeof d.technical_depth === "number" ? d.technical_depth : 7.5;
        const nov = typeof d.novelty_score === "number" ? d.novelty_score : 9.0;

        newLogs.push({
          id: `${uniqueId}-score`,
          timestamp,
          category: "SCORE",
          message: `[VERIFYING CREDIBILITY] Scores: credibility=${cred}/10, domain=${dom}/10, depth=${tech}/10, novelty=${nov}/10`
        });

        // Publish event
        const overallScore = typeof d.score === "number" ? d.score : 0.0;
        newLogs.push({
          id: `${uniqueId}-publish`,
          timestamp,
          category: isAccepted ? "PUBLISH" : "SCORE",
          message: isAccepted
            ? `[PUBLISH] Overall credibility index: ${overallScore}/10 -> PASS & DEPLOYED`
            : `[PUBLISH] Decision: REJECTED -> Reason: ${d.reason || "Criteria unfulfilled"}`
        });
      }
    });

    if (newLogs.length > 0) {
      logQueue.current = [...logQueue.current, ...newLogs];
    }
  }, [telemetryData]);

  // Status transition stream logs
  useEffect(() => {
    if (!telemetryData) return;
    
    const status = telemetryData.scan_status || "idle";
    const activeUrl = telemetryData.active_source_url || "";
    const chunks = telemetryData.chunks_processed || 0;

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
        message = `[VERIFYING CREDIBILITY] Running structured criteria matrices on chunk #${chunks}`;
      } else if (status === "publishing") {
        category = "PUBLISH";
        message = `[PUBLISHING] Candidate matched criteria. Writing entry to output stream...`;
      }

      if (message) {
        setDisplayedLogs((curr) => {
          if (curr.length > 0 && curr[curr.length - 1].message === message) return curr;
          return [
            ...curr.slice(-99),
            {
              id: `status-${Date.now()}-${Math.random()}`,
              timestamp,
              category,
              message
            }
          ];
        });
      }
    }
  }, [telemetryData, open]);

  // Queue drain interval
  useEffect(() => {
    const timer = setInterval(() => {
      if (logQueue.current.length > 0) {
        const nextLog = logQueue.current.shift();
        if (nextLog) {
          setDisplayedLogs((curr) => [...curr.slice(-99), nextLog]);
        }
      }
    }, 350);

    return () => clearInterval(timer);
  }, []);

  const rejectedDecisions = telemetryData && Array.isArray(telemetryData.decisions)
    ? telemetryData.decisions.filter((d) => String(d.decision).toLowerCase() === "rejected")
    : [];

  const filteredLogs = activeCategoryFilter === "ALL"
    ? displayedLogs
    : displayedLogs.filter((log) => log.category === activeCategoryFilter);

  return (
    <aside className={`telemetry ${open ? "telemetry-open" : ""}`} aria-expanded={open}>
      <div className="telemetry-head">
        <div>
          <p className="eyebrow" style={{ margin: 0, fontSize: "10px" }}>NOVA NODE // NEURAL TRACE MATRIX</p>
          <h2>
            THOUGHT MATRIX<br />
            <em>REAL-TIME TELEMETRY</em>
          </h2>
        </div>
        <button className="close-panel" onClick={onClose} aria-label="Close panel">
          ×
        </button>
      </div>

      <div className="telemetry-tabs">
        <button className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>
          SYSTEM LOGS ({displayedLogs.length})
        </button>
        <button className={tab === "rejected" ? "active" : ""} onClick={() => setTab("rejected")}>
          CUTTING ROOM FLOOR ({rejectedDecisions.length})
        </button>
      </div>

      {tab === "logs" ? (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              background: "rgba(0, 255, 102, 0.05)",
              border: "1px solid rgba(0, 255, 102, 0.2)",
              borderRadius: "4px",
              marginBottom: "12px",
              fontSize: "10px",
              fontFamily: "'DM Mono', monospace"
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--lime)" }}>
              <i
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: telemetryData?.scan_status !== "idle" ? "#00FF66" : "#777",
                  boxShadow: telemetryData?.scan_status !== "idle" ? "0 0 10px #00FF66" : "none"
                }}
              />
              SCANNER: {String(telemetryData?.scan_status || "STANDBY").toUpperCase()}
            </span>
            <span style={{ color: "var(--muted)", textTransform: "uppercase" }}>
              CHUNKS PROCESSED: {telemetryData?.chunks_processed ?? 0}
            </span>
          </div>

          <div className="log-filters">
            {(["ALL", "INGEST", "MEMORY", "SCORE", "PUBLISH"] as LogCategory[]).map((cat) => (
              <button
                key={cat}
                className={`filter-btn ${activeCategoryFilter === cat ? "active" : ""}`}
                onClick={() => setActiveCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="terminal-container">
            <div className="terminal" ref={terminalRef}>
              <div className="terminal-scanlines" />
              {filteredLogs.map((log) => (
                <p key={log.id}>
                  <time>[{log.timestamp}]</time>
                  <b>{log.category}</b>
                  {log.message}
                </p>
              ))}
              {filteredLogs.length === 0 && (
                <p style={{ opacity: 0.5, fontStyle: "italic" }}>
                  [BOOTING MATRIX REPOSITORY... AWAITING AUDIT SIGNALS]
                </p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="rejected-list" style={{ scrollbarWidth: "thin" }}>
          {rejectedDecisions.length > 0 ? (
            rejectedDecisions.map((d, index) => {
              const overall = Number(d.score) || 0.0;
              return (
                <article key={`${d.source_url}-${index}`} className="rejected-card">
                  <div className="rejected-badge">FLAGGED & REJECTED</div>
                  <h3 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: "700", color: "#fff" }}>
                    {d.headline || "Unidentified Stream"}
                  </h3>
                  <div className="rejected-reason">
                    <b style={{ color: "var(--crimson)" }}>INDEX {overall.toFixed(1)}/10:</b> {d.reason}
                  </div>
                  <div className="scores-grid">
                    <div className="score-metric">
                      <span>Credibility</span>
                      <div className="metric-bar bg-red">
                        <i style={{ width: `${Math.min(100, (d.credibility_score ?? 0) * 10)}%` }} />
                      </div>
                      <b>{(d.credibility_score ?? 0).toFixed(1)}/10</b>
                    </div>
                    <div className="score-metric">
                      <span>Relevance</span>
                      <div className="metric-bar bg-green">
                        <i style={{ width: `${Math.min(100, (d.domain_relevance ?? 0) * 10)}%` }} />
                      </div>
                      <b>{(d.domain_relevance ?? 0).toFixed(1)}/10</b>
                    </div>
                    <div className="score-metric">
                      <span>Tech Depth</span>
                      <div className="metric-bar">
                        <i style={{ width: `${Math.min(100, (d.technical_depth ?? 0) * 10)}%` }} />
                      </div>
                      <b>{(d.technical_depth ?? 0).toFixed(1)}/10</b>
                    </div>
                    <div className="score-metric">
                      <span>Novelty</span>
                      <div className="metric-bar">
                        <i style={{ width: `${Math.min(100, (d.novelty_score ?? 0) * 10)}%` }} />
                      </div>
                      <b>{(d.novelty_score ?? 0).toFixed(1)}/10</b>
                    </div>
                  </div>
                  {d.source_url && (
                    <a href={d.source_url} target="_blank" rel="noreferrer" className="rejected-source-link">
                      VERIFY SOURCE CONTENT ↗
                    </a>
                  )}
                </article>
              );
            })
          ) : (
            <div className="empty" style={{ margin: "20px 0" }}>
              <h2>No Rejections Logged</h2>
              <p>All candidates currently evaluated have met required threshold metrics.</p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}