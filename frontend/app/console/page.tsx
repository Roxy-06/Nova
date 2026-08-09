"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QueueView } from "../components/QueueView";
import { PendingQueue } from "../components/PendingQueue";
import { TelemetryPanel } from "../components/TelemetryPanel";
import { CountdownTimer } from "../components/CountdownTimer";
import { AudioAnnouncer } from "../components/AudioAnnouncer";
import { useVoiceAnnouncer } from "../components/useVoiceAnnouncer";
import type { QueuedPost, FeedPost, TelemetryDecision } from "../components/types";

export default function ConsolePage() {
  const search = useSearchParams();
  const router = useRouter();
  const agentId = search.get("agentId");
  const topic = search.get("topic") || "Autonomous AI Initiation";
  const domain = search.get("domain") || "Autonomous AI Systems";
  const mode = search.get("mode") || "JARVIS";

  const [agentName, setAgentName] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<any | null>(null);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<"feed" | "queue" | "decisions">("feed");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { speak } = useVoiceAnnouncer(feedPosts, audioEnabled);

  // Sync mode-specific agentId in localStorage so switches are instant and remembered
  useEffect(() => {
    if (agentId && (mode === "JARVIS" || mode === "ULTRON")) {
      localStorage.setItem(`novanode_agent_${mode}`, agentId);
    }
  }, [agentId, mode]);

  // Handle agent validation & recovery if agentId is missing
  useEffect(() => {
    if (!agentId) {
      const storedId = localStorage.getItem(`novanode_agent_${mode}`);
      if (storedId) {
        const query = new URLSearchParams({
          agentId: storedId,
          topic,
          domain: mode === "JARVIS" ? "Autonomous AI Systems" : "Autonomous Security & Override Matrix",
          mode
        }).toString();
        router.replace(`/console?${query}`);
      } else {
        // Needs auto initialization
        async function autoInit() {
          try {
            const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
            const launchDomain = mode === "JARVIS" ? "Autonomous AI Systems" : "Autonomous Security & Override Matrix";
            const res = await fetch(`${API_BASE}/api/agent/init`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                persona: {
                  name: `${mode} Agent`,
                  domain: launchDomain
                }
              }),
            });
            if (!res.ok) throw new Error(`Agent auto-init failed: ${res.status}`);
            const data = await res.json();
            const newAgentId = data.agentId;
            if (!newAgentId) throw new Error("No agentId returned");
            localStorage.setItem(`novanode_agent_${mode}`, newAgentId);
            const query = new URLSearchParams({
              agentId: newAgentId,
              topic: "Autonomous AI Initiation",
              domain: launchDomain,
              mode
            }).toString();
            router.replace(`/console?${query}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to auto-init agent.");
            setLoading(false);
          }
        }
        autoInit();
      }
      return;
    }

    async function loadAgent() {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
        const res = await fetch(`${API_BASE}/api/agent/${agentId}`);
        if (!res.ok) throw new Error(`Agent not found (${res.status})`);
        const summary = await res.json();
        setAgentName(summary.name || `${mode} Agent`);
      } catch (err) {
        console.error("Load agent error:", err);
        setAgentName(`${mode} Agent`);
      }
    }
    loadAgent();
  }, [agentId, mode, router, topic, domain]);

  // Synchronized polls for Telemetry & Feed
  useEffect(() => {
    if (!agentId) return;
    let mounted = true;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

    async function fetchData() {
      try {
        const [telRes, feedRes] = await Promise.all([
          fetch(`${API_BASE}/api/agent/telemetry?agentId=${agentId}`),
          fetch(`${API_BASE}/api/agent/feed?agentId=${agentId}`)
        ]);
        if (!mounted) return;

        if (telRes.ok) {
          const telBody = await telRes.json();
          setTelemetry(telBody);
        }
        if (feedRes.ok) {
          const feedBody = await feedRes.json();
          setFeedPosts(feedBody.posts || []);
        }
        setError(null);
      } catch (err) {
        console.error("Polling error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();
    const t = setInterval(fetchData, 4000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [agentId]);

  // Mode switcher inside console - falls back to stored agent or auto-creates it
  const handleModeSwitch = async (newMode: "JARVIS" | "ULTRON") => {
    if (newMode === mode) return;
    setLoading(true);
    const storedId = localStorage.getItem(`novanode_agent_${newMode}`);
    const launchDomain = newMode === "JARVIS" ? "Autonomous AI Systems" : "Autonomous Security & Override Matrix";

    if (storedId) {
      const query = new URLSearchParams({
        agentId: storedId,
        topic,
        domain: launchDomain,
        mode: newMode
      }).toString();
      router.push(`/console?${query}`);
    } else {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
        const res = await fetch(`${API_BASE}/api/agent/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            persona: {
              name: `${newMode} Agent`,
              domain: launchDomain
            }
          }),
        });
        if (!res.ok) throw new Error("Switch init error");
        const data = await res.json();
        const newAgentId = data.agentId;
        if (!newAgentId) throw new Error("Missing agentId");
        localStorage.setItem(`novanode_agent_${newMode}`, newAgentId);
        const query = new URLSearchParams({
          agentId: newAgentId,
          topic: "Autonomous AI Initiation",
          domain: launchDomain,
          mode: newMode
        }).toString();
        router.push(`/console?${query}`);
      } catch (err) {
        setError("Failed to initialize target mode Agent.");
        setLoading(false);
      }
    }
  };

  const handlePublishNow = async (postId: string) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
    try {
      const res = await fetch(`${API_BASE}/api/agent/queue/${postId}/publish-now?agentId=${agentId}`, { method: "POST" });
      if (res.ok) {
        // Trigger rapid refresh
        const [telRes, feedRes] = await Promise.all([
          fetch(`${API_BASE}/api/agent/telemetry?agentId=${agentId}`),
          fetch(`${API_BASE}/api/agent/feed?agentId=${agentId}`)
        ]);
        if (telRes.ok) setTelemetry(await telRes.json());
        if (feedRes.ok) setFeedPosts((await feedRes.json()).posts || []);
      }
    } catch (err) {
      console.error("Immediate release failed:", err);
    }
  };

  const isUltron = mode === "ULTRON";
  const primaryColor = isUltron ? "var(--crimson)" : "var(--cyan)";
  const primaryDim = isUltron ? "rgba(255, 51, 102, 0.12)" : "rgba(0, 243, 255, 0.12)";
  const primaryGlow = isUltron ? "rgba(255, 51, 102, 0.45)" : "rgba(0, 243, 255, 0.45)";

  if (error) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#040605",
        color: "#f5f1e9",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "'DM Mono', monospace",
        padding: 40
      }}>
        <div style={{ border: `1px solid var(--crimson)`, padding: 32, borderRadius: 8, background: "rgba(255,51,102,0.06)", maxWidth: 500, textAlign: "center" }}>
          <h2 style={{ color: "var(--crimson)", margin: "0 0 16px" }}>DEPLOYMENT FAILURE</h2>
          <p style={{ color: "var(--muted)", margin: "0 0 24px", lineHeight: 1.6 }}>{error}</p>
          <button
            onClick={() => router.push("/")}
            style={{
              background: "var(--crimson)",
              color: "#000",
              fontWeight: "900",
              border: 0,
              padding: "10px 24px",
              cursor: "pointer",
              borderRadius: 4
            }}
          >
            RETURN TO DECK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#040605",
      color: "#f5f1e9",
      fontFamily: "'Manrope', sans-serif",
      position: "relative",
      paddingBottom: 80
    }}>
      {/* Dynamic Mode Colors Override */}
      <style jsx global>{`
        :root {
          --lime: ${primaryColor};
          --lime-dim: ${primaryDim};
          --lime-glow: ${primaryGlow};
          --panel-border: ${isUltron ? 'rgba(255, 51, 102, 0.18)' : 'rgba(0, 243, 255, 0.18)'};
        }
      `}</style>

      {/* Atmospheric BG Grid */}
      <div className="grid" style={{ position: "fixed", opacity: 0.15 }} />

      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 20px" }}>

        {/* Sleek Modern Header */}
        <header
          style={{
            backdropFilter: "blur(20px)",
            background: "rgba(4, 6, 5, 0.85)",
            border: "1px solid var(--line)",
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderRadius: "10px",
            marginBottom: "24px",
            boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4)`
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              className="mark"
              style={{
                background: primaryColor,
                boxShadow: `0 0 20px ${primaryGlow}`,
                transition: "all 0.4s ease"
              }}
            >
              {isUltron ? "U" : "J"}
            </div>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "14px", fontWeight: 800, letterSpacing: "0.18em", color: "#fff" }}>
                NOVA NODE // {mode} CONSOLE
              </div>
              <div style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>
                {domain} • OPERATIONAL
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Mode Switcher */}
            <div style={{ display: "flex", background: "rgba(16, 20, 16, 0.9)", padding: "4px", borderRadius: "6px", border: "1px solid var(--line)" }}>
              <button
                type="button"
                onClick={() => handleModeSwitch("JARVIS")}
                style={{
                  border: 0,
                  background: !isUltron ? "var(--cyan-dim)" : "transparent",
                  color: !isUltron ? "var(--cyan)" : "var(--muted)",
                  padding: "6px 16px",
                  font: "700 10px 'DM Mono', monospace",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.3s ease"
                }}
              >
                JARVIS V4
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch("ULTRON")}
                style={{
                  border: 0,
                  background: isUltron ? "var(--crimson-dim)" : "transparent",
                  color: isUltron ? "var(--crimson)" : "var(--muted)",
                  padding: "6px 16px",
                  font: "700 10px 'DM Mono', monospace",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.3s ease"
                }}
              >
                ULTRON PRIME
              </button>
            </div>

            <button
              onClick={() => setTelemetryOpen(true)}
              style={{
                background: "rgba(0, 255, 102, 0.12)",
                border: "1px solid var(--lime)",
                color: "var(--lime)",
                padding: "8px 16px",
                font: "700 10px 'DM Mono', monospace",
                borderRadius: "4px",
                cursor: "pointer",
                boxShadow: "0 0 16px rgba(0,255,102,0.12)"
              }}
            >
              🔍 DECK logs
            </button>

            <button
              onClick={() => router.push(`/`)}
              style={{
                background: "transparent",
                border: "1px solid var(--line)",
                color: "var(--muted)",
                padding: "8px 16px",
                font: "700 10px 'DM Mono', monospace",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              ⏏ EXIT
            </button>
          </div>
        </header>

        {/* Global Loading Overlay inside main window */}
        {loading ? (
          <div style={{
            height: "60vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            fontFamily: "'DM Mono', monospace"
          }}>
            <div style={{
              width: 50,
              height: 50,
              border: `3px solid ${primaryDim}`,
              borderTopColor: primaryColor,
              borderRadius: "50%",
              animation: "rotateRadar 1.5s linear infinite"
            }} />
            <p style={{ marginTop: 24, letterSpacing: "0.2em", color: "var(--muted)" }}>SYNAPSE SYNC IN PROGRESS...</p>
          </div>
        ) : (
          <>
            {/* Real-time scan banner & voice broadcast matrix */}
            <div className="scanning-banner" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="banner-pulse" />
                <CountdownTimer nextPublishAt={telemetry?.next_publish_at ?? null} queueSize={telemetry?.queue_size ?? 0} />
              </div>
              <AudioAnnouncer
                enabled={audioEnabled}
                onToggle={() => setAudioEnabled(prev => !prev)}
                onReadLatest={() => {
                  if (feedPosts.length > 0) speak(feedPosts[0].text);
                }}
                onToggleTelemetry={() => setTelemetryOpen(prev => !prev)}
              />
            </div>

            {/* Split Workspace Layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px", alignItems: "start" }}>

              {/* Main Feed panel and selector */}
              <div>
                <div className="view-toggle-bar" style={{ margin: "0 0 20px 0" }}>
                  <button className={activeTab === "feed" ? "active" : ""} onClick={() => setActiveTab("feed")}>
                    ⚡ LIVE TRANSMISSION ({feedPosts.length})
                  </button>
                  <button className={activeTab === "queue" ? "active" : ""} onClick={() => setActiveTab("queue")}>
                    📋 EDITORIAL QUEUE ({telemetry?.queue_size ?? 0})
                  </button>
                  <button className={activeTab === "decisions" ? "active" : ""} onClick={() => setActiveTab("decisions")}>
                    🔍 SCANNING ARCHIVE ({telemetry?.decisions?.length ?? 0})
                  </button>
                </div>

                {/* Tab content renders */}
                {activeTab === "feed" && (
                  <div className="feed" style={{ borderTop: "none", marginTop: 0 }}>
                    {feedPosts.map((post, index) => (
                      <article className="post" key={post.id}>
                        <div className="post-index">
                          #{String(post.sequenceNumber || feedPosts.length - index).padStart(2, "0")}
                        </div>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <time>{new Date(post.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" })}</time>
                            <span className="status-badge published">⚡ PUBLISHED</span>
                          </div>

                          <p className="post-text">{post.text}</p>

                          {/* Real Per-Post Score metrics */}
                          <div className="scores-grid-row">
                            <div className="micro-metric">
                              <span className="label">CREDIBILITY:</span>
                              <span className="value">
                                {post.credibilityScore != null ? `${post.credibilityScore.toFixed(1)}/10` : "N/A"}
                              </span>
                            </div>
                            <div className="micro-metric">
                              <span className="label">DOMAIN FIT:</span>
                              <span className="value">
                                {post.domainRelevance != null ? `${post.domainRelevance.toFixed(1)}/10` : "N/A"}
                              </span>
                            </div>
                            <div className="micro-metric">
                              <span className="label">CS DEPTH:</span>
                              <span className="value">
                                {post.technicalDepth != null ? `${post.technicalDepth.toFixed(1)}/10` : "N/A"}
                              </span>
                            </div>
                            <div className="micro-metric">
                              <span className="label">NOVELTY:</span>
                              <span className="value">
                                {post.noveltyScore != null ? `${post.noveltyScore.toFixed(1)}/10` : "N/A"}
                              </span>
                            </div>
                            {post.overallScore != null && (
                              <div className="micro-metric" style={{ marginLeft: "auto" }}>
                                <span className="label" style={{ color: "var(--lime)" }}>INDEX:</span>
                                <span className="value" style={{ color: "var(--lime)", fontWeight: 800 }}>{post.overallScore.toFixed(1)}/10</span>
                              </div>
                            )}
                          </div>

                          {/* Expandable rationale deck */}
                          <details className="rationale" style={{ marginTop: 14 }}>
                            <summary>
                              <span>VIEW DECISION LOGIC</span>
                              <b>+</b>
                            </summary>
                            <div className="rationale-body">
                              <p>OVERALL GATING MATRIX: <span>{post.overallScore?.toFixed(1) ?? "N/A"}/10</span></p>
                              <div className="match-bar">
                                <i style={{ width: `${(post.overallScore || 0) * 10}%` }} />
                              </div>
                              <h4>DECISION RATIONALE</h4>
                              <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: "1.6", margin: 0 }}>
                                {post.rationale}
                              </p>
                            </div>
                          </details>

                          <div className="sources" style={{ marginTop: 14 }}>
                            {post.sources.map((source) => (
                              <a key={source} href={source} target="_blank" rel="noreferrer">
                                VERIFY SOURCE ↗
                              </a>
                            ))}
                          </div>
                        </div>
                      </article>
                    ))}
                    {feedPosts.length === 0 && (
                      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)", border: "1px dashed var(--line)", borderRadius: 8 }}>
                        <h3>TRANS-SHIELD SILENT</h3>
                        <p>No posts published by the model yet. Ensure the scanner scheduler has candidates queued.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "queue" && (
                  <div>
                    {telemetry?.queue && telemetry.queue.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <PendingQueue queue={telemetry.queue as QueuedPost[]} />
                      </div>
                    )}
                    <QueueView
                      queue={(telemetry?.queue ?? []) as QueuedPost[]}
                      nextPublishAt={telemetry?.next_publish_at ?? null}
                      onPublishNow={handlePublishNow}
                    />
                  </div>
                )}

                {activeTab === "decisions" && (
                  <div className="scanning-decisions">
                    {telemetry?.decisions?.map((d: TelemetryDecision, idx: number) => {
                      const isAccepted = String(d.decision).toLowerCase() === "accepted";
                      const overall = Number(d.score) || 0.0;
                      return (
                        <article
                          key={`${d.source_url}-${idx}`}
                          style={{
                            background: "rgba(10, 14, 11, 0.6)",
                            border: isAccepted ? `1px solid var(--lime)` : "1px solid var(--line)",
                            borderRadius: "6px",
                            padding: "20px",
                            marginBottom: "16px",
                            position: "relative"
                          }}
                        >
                          <span
                            className={`status-badge ${isAccepted ? "published" : "rejected"}`}
                            style={{
                              position: "absolute",
                              top: "16px",
                              right: "16px"
                            }}
                          >
                            {isAccepted ? "QUEUED" : "REJECTED"}
                          </span>

                          <p style={{ font: "10px 'DM Mono', monospace", color: "var(--muted)", margin: "0 0 8px" }}>
                            VERIFIED AT // {new Date(d.decided_at).toLocaleTimeString()}
                          </p>

                          <h3 style={{ margin: "0 0 12px", fontSize: "15px", color: "#fff", paddingRight: "100px" }}>
                            {d.headline || "Source stream segment"}
                          </h3>

                          <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "12px", lineHeight: "1.5" }}>
                            <strong style={{ color: isAccepted ? "var(--lime)" : "var(--crimson)" }}>
                              GATING SCORE: {overall.toFixed(1)}/10
                            </strong>
                            <p style={{ margin: "6px 0 0", fontStyle: "italic" }}>{d.reason}</p>
                          </div>

                          {/* Individual scores metrics summary */}
                          <div className="scores-grid-row" style={{ padding: "8px 12px", margin: "12px 0", background: "rgba(0,0,0,0.2)", border: "none" }}>
                            <div className="micro-metric">
                              <span className="label">CREDIBILITY:</span>
                              <span className="value">{d.credibility_score != null ? `${d.credibility_score.toFixed(1)}/10` : "N/A"}</span>
                            </div>
                            <div className="micro-metric">
                              <span className="label">RELEVANCE:</span>
                              <span className="value">{d.domain_relevance != null ? `${d.domain_relevance.toFixed(1)}/10` : "N/A"}</span>
                            </div>
                            <div className="micro-metric">
                              <span className="label">DEPTH:</span>
                              <span className="value">{d.technical_depth != null ? `${d.technical_depth.toFixed(1)}/10` : "N/A"}</span>
                            </div>
                            <div className="micro-metric">
                              <span className="label">NOVELTY:</span>
                              <span className="value">{d.novelty_score != null ? `${d.novelty_score.toFixed(1)}/10` : "N/A"}</span>
                            </div>
                          </div>

                          {d.source_url && (
                            <a href={d.source_url} target="_blank" rel="noreferrer" className="cr-source-btn">
                              VERIFY SOURCE ↗
                            </a>
                          )}
                        </article>
                      );
                    })}
                    {(!telemetry?.decisions || telemetry.decisions.length === 0) && (
                      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)", border: "1px dashed var(--line)", borderRadius: 8 }}>
                        <h3>ARCHIVE STANDBY</h3>
                        <p>No scanner decisions logged in this window. Awaiting ingest matches.</p>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Sidebar Quick controls and status readouts */}
              <aside>
                <div
                  style={{
                    background: "rgba(10, 14, 11, 0.75)",
                    border: "1px solid var(--line)",
                    padding: "20px",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
                  }}
                >
                  <p className="eyebrow" style={{ margin: "0 0 16px" }}>CONTROL HUD</p>

                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>AGENT IDENTIFIER</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff", marginTop: "4px" }}>{agentName || "Loading..."}</div>
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>SPECIALTY DOMAIN</div>
                    <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>{domain}</div>
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>SEED INITIATIVE</div>
                    <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>{topic}</div>
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>EDITORIAL QUEUE SIZE</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: primaryColor, marginTop: "4px" }}>
                      {telemetry?.queue_size ?? 0} item(s) pending
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid var(--line)", paddingTop: "16px", marginTop: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", fontFamily: "'DM Mono', monospace", color: "var(--muted)" }}>
                      <span>SCAN STATUS:</span>
                      <span style={{ color: telemetry?.scan_status !== "idle" ? "var(--lime)" : "var(--muted)" }}>
                        {String(telemetry?.scan_status || "IDLE").toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", fontFamily: "'DM Mono', monospace", color: "var(--muted)", marginTop: 8 }}>
                      <span>SYS FEED POLL:</span>
                      <span>ACTIVE (4S)</span>
                    </div>
                  </div>
                </div>
              </aside>

            </div>
          </>
        )}

      </main>

      {/* Floating System-wide Log HUD Drawer overlay */}
      <TelemetryPanel open={telemetryOpen} onClose={() => setTelemetryOpen(false)} telemetryData={telemetry} />
    </div>
  );
}
