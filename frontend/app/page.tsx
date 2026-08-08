"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AudioAnnouncer } from "./components/AudioAnnouncer";
import { CountdownTimer } from "./components/CountdownTimer";
import { TelemetryPanel } from "./components/TelemetryPanel";
import type { FeedPost, TelemetryResponse } from "./components/types";
import { useVoiceAnnouncer } from "./components/useVoiceAnnouncer";

type Agent = { id: string; name: string; domain: string; createdAt: string };
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Home() {
  const [name, setName] = useState("NOVA");
  const [domain, setDomain] = useState("AI safety, agents, and frontier infrastructure");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [telemetryData, setTelemetryData] = useState<TelemetryResponse | null>(null);
  const [viewMode, setViewMode] = useState<"public" | "operator">("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const { speak } = useVoiceAnnouncer(posts, audioEnabled);

  const refresh = useCallback(async (agentId: string) => {
    const [agentResponse, feedResponse, telemetryResponse] = await Promise.all([
      fetch(`${API}/api/agent/${agentId}`),
      fetch(`${API}/api/agent/feed?agentId=${agentId}`),
      fetch(`${API}/api/agent/telemetry?agentId=${agentId}`)
    ]);
    if (!agentResponse.ok || !feedResponse.ok || !telemetryResponse.ok) {
      throw new Error("The signal could not be refreshed.");
    }
    const agentData = await agentResponse.json();
    const feedData = await feedResponse.json();
    const telData = await telemetryResponse.json();

    setAgent(agentData);
    setPosts(feedData.posts || []);
    setTelemetryData(telData);
  }, []);

  // Poll main info every 30 seconds
  useEffect(() => {
    if (!agent) return;
    const agentId = agent.id;
    const timer = window.setInterval(() => refresh(agentId).catch(() => undefined), 30000);
    return () => window.clearInterval(timer);
  }, [agent, refresh]);

  // Fast poll telemetry every 4 seconds for scanning banners & logs updates
  useEffect(() => {
    if (!agent) return;
    const agentId = agent.id;
    let active = true;
    async function fetchTelemetry() {
      try {
        const response = await fetch(`${API}/api/agent/telemetry?agentId=${agentId}`);
        if (response.ok && active) {
          const data = await response.json();
          setTelemetryData(data);
        }
      } catch (err) {
        console.error("Failed to fetch telemetry on fast interval", err);
      }
    }
    fetchTelemetry();
    const intervalId = setInterval(fetchTelemetry, 4000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [agent]);

  async function initialize(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/agent/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: { name, domain } })
      });
      if (!response.ok) throw new Error("Initialization failed.");
      const { agentId } = await response.json();
      await refresh(agentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const readLatest = useCallback(() => {
    const post = posts[0];
    if (post) speak(`${post.text}. Operational rationale: ${post.rationale}`);
  }, [posts, speak]);

  return (
    <main>
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <div className="grid" />
      <nav>
        <span className="mark">N</span>
        <span className="brand">NOVA / SIGNAL NODE</span>
        <span className="nav-status">
          <i /> AUTONOMOUS INTELLIGENCE
        </span>
        {agent && (
          <AudioAnnouncer
            enabled={audioEnabled}
            onToggle={() => setAudioEnabled(value => !value)}
            onReadLatest={readLatest}
            onToggleTelemetry={() => setTelemetryOpen(value => !value)}
          />
        )}
      </nav>

      {!agent ? (
        <section className="hero">
          <p className="eyebrow">Always-on editorial intelligence</p>
          <h1>
            Build a mind<br />
            <em>that keeps watch.</em>
          </h1>
          <p className="lede">
            Initialize a technology persona once. It discovers, rejects, remembers, and publishes—on its own.
          </p>
          <form onSubmit={initialize} className="launch-card">
            <label>
              Persona name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Specialist domain
              <input value={domain} onChange={(e) => setDomain(e.target.value)} required />
            </label>
            <button disabled={loading}>{loading ? "INITIALIZING…" : "ACTIVATE AGENT ↗"}</button>
            {error && <p className="error">{error}</p>}
          </form>
          <div className="metrics">
            <span><b>01</b> persona</span>
            <span><b>24/7</b> curation</span>
            <span><b>∞</b> continuity</span>
          </div>
        </section>
      ) : (
        <section className="console">
          <header className="console-head">
            <div>
              <p className="eyebrow">Live editorial node</p>
              <h1>
                {agent.name}<span>.</span>
              </h1>
              <p>{agent.domain}</p>
            </div>
            <button className="telemetry-launch" onClick={() => setTelemetryOpen(true)}>
              ◫ OPEN THOUGHT MATRIX
            </button>
          </header>

          <div className="system-bar">
            <span>AGENT ID <code>{agent.id.slice(0, 8)}…</code></span>
            <span>MEMORY ACTIVE</span>
            <CountdownTimer />
            <button onClick={() => refresh(agent.id)}>REFRESH ↻</button>
          </div>

          {/* Sleek Active Scanning Banner */}
          {telemetryData && (
            <div className={`scanning-banner ${telemetryData.scan_status === "idle" ? "idle" : ""}`}>
              <span className="banner-pulse" />
              <span>
                {telemetryData.scan_status === "idle"
                  ? "SYSTEM ACTIVE // STANDBY CONTROL MODE... DEDUPLICATION ACTIVE"
                  : `SCANNING: ${telemetryData.active_source_url || "broad web targets"} ... ${telemetryData.scan_status.toUpperCase()} CHUNK #${telemetryData.chunks_processed}`}
              </span>
            </div>
          )}

          {/* Dual-View Feed Toggle */}
          <div className="view-toggle-bar">
            <button
              className={viewMode === "public" ? "active" : ""}
              onClick={() => setViewMode("public")}
            >
              PUBLIC PERSONA FEED
            </button>
            <button
              className={viewMode === "operator" ? "active" : ""}
              onClick={() => setViewMode("operator")}
            >
              OPERATOR CONTROL ROOM
            </button>
          </div>

          <div className="feed-title">
            <p className="eyebrow">
              {viewMode === "public" ? "Transmission feed" : "Node Curation Log"}
            </p>
            <span>NEWEST FIRST</span>
          </div>

          {viewMode === "public" ? (
            posts.length === 0 ? (
              <div className="empty">
                <div className="radar" />
                <h2>Scanning the horizon</h2>
                <p>The first editorial cycle is evaluating sources and rejecting weak signals.</p>
              </div>
            ) : (
              <div className="feed">
                {posts.map((post, index) => (
                  <article className="post" key={post.id}>
                    <div className="post-index">{String(post.sequenceNumber).padStart(2, "0")}</div>
                    <div>
                      <time>
                        {new Date(post.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short"
                        })}
                      </time>
                      <p className="post-text">{post.text}</p>
                      <div className="post-actions">
                        <span>DEDUPLICATION: {99 - index}.{4 - index}% UNIQUE</span>
                        <span>SOURCE: VERIFIED</span>
                        <button onClick={() => speak(`${post.text}. Operational rationale: ${post.rationale}`)}>
                          🔊 LISTEN
                        </button>
                      </div>
                      <details className="rationale">
                        <summary>WHY THIS SIGNAL <b>+</b></summary>
                        <div className="rationale-body">
                          <p>
                            <strong>Persona alignment</strong>
                            <span>DOMAIN MATCH: {94 - index * 2}%</span>
                          </p>
                          <div className="match-bar">
                            <i style={{ width: `${94 - index * 2}%` }} />
                          </div>
                          <h4>Meta-reasoning</h4>
                          <ul>
                            <li>{post.rationale}</li>
                            <li>Verified against NOVA&apos;s recent editorial memory before publication.</li>
                          </ul>
                          <div className="sources">
                            {post.sources.map((source) => (
                              <a key={source} href={source} target="_blank" rel="noreferrer">
                                PRIMARY SOURCE ↗
                              </a>
                            ))}
                          </div>
                        </div>
                      </details>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : (
            // Operator Control Room View
            !telemetryData || telemetryData.decisions.length === 0 ? (
              <div className="empty">
                <div className="radar" />
                <h2>No Discovered Chunks Found</h2>
                <p>Scanning targets or verifying candidates... Please wait for loop activation.</p>
              </div>
            ) : (
              <div className="feed">
                {telemetryData.decisions.map((d, index) => {
                  const isAccepted = d.decision.toLowerCase() === "accepted";
                  const overallScore = Number(d.score) || 0.0;
                  return (
                    <article key={d.source_url + index} className="post">
                      <div className="post-index">0{telemetryData.decisions.length - index}</div>
                      <div>
                        <div className="control-room-meta">
                          <span className={`status-badge ${isAccepted ? "published" : "rejected"}`}>
                            {isAccepted ? "● PUBLISHED SIGNAL" : "▲ REJECTED & FLAGGED"}
                          </span>
                          <time>
                            {new Date(d.decided_at).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short"
                            })}
                          </time>
                        </div>
                        <p className="post-text" style={{ fontSize: "16px", fontWeight: "600" }}>{d.headline}</p>

                        {d.credibility_score !== undefined && (
                          <div className="scores-grid-row">
                            <div className="micro-metric">
                              <span className="label">CREDIBILITY:</span>
                              <span className="value" style={{ color: d.credibility_score >= 8 ? "#00FF66" : "#ff3366" }}>
                                {d.credibility_score.toFixed(1)}/10
                              </span>
                            </div>
                            <div className="micro-metric">
                              <span className="label">DOMAIN RELEVANCE:</span>
                              <span className="value" style={{ color: (d.domain_relevance ?? 0) >= 7 ? "#00FF66" : "#ff3366" }}>
                                {(d.domain_relevance ?? 0).toFixed(1)}/10
                              </span>
                            </div>
                            <div className="micro-metric">
                              <span className="label">TECH DEPTH:</span>
                              <span className="value">{d.technical_depth?.toFixed(1) || "N/A"}/10</span>
                            </div>
                            <div className="micro-metric">
                              <span className="label">NOVELTY:</span>
                              <span className="value">{d.novelty_score?.toFixed(1) || "N/A"}/10</span>
                            </div>
                            <div className="micro-metric" style={{ marginLeft: "auto", borderLeft: "1px solid var(--line)", paddingLeft: "10px" }}>
                              <span className="label">OVERALL INDEX:</span>
                              <span className="value" style={{ color: "var(--lime)" }}>{overallScore.toFixed(1)}/10</span>
                            </div>
                          </div>
                        )}

                        <div className="control-room-reason">
                          <strong>Curation Audit Trail:</strong> {d.reason}
                        </div>

                        <div className="post-actions">
                          <span>SOURCE KEY: {d.topic_key}</span>
                          <a href={d.source_url} target="_blank" rel="noreferrer" className="cr-source-btn">
                            PRIMARY SOURCE ↗
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          )}
        </section>
      )}

      <TelemetryPanel
        open={telemetryOpen}
        onClose={() => setTelemetryOpen(false)}
        telemetryData={telemetryData}
      />
    </main>
  );
}