"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AudioAnnouncer } from "./components/AudioAnnouncer";
import { CountdownTimer } from "./components/CountdownTimer";
import { PendingQueue } from "./components/PendingQueue";
import { QueueView } from "./components/QueueView";
import { TelemetryPanel } from "./components/TelemetryPanel";
import type { FeedPost, TelemetryResponse } from "./components/types";
import { useVoiceAnnouncer } from "./components/useVoiceAnnouncer";

type Agent = {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
  personaThroughline?: string | null;
  personaBiases?: string[];
  personaSignatureMove?: string | null;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Home() {
  const [name, setName] = useState("NOVA");
  const [domain, setDomain] = useState("AI safety, agents, and frontier infrastructure");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [telemetryData, setTelemetryData] = useState<TelemetryResponse | null>(null);
  const [viewMode, setViewMode] = useState<"public" | "queue" | "operator">("public");
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

  // Fast poll telemetry every 4 seconds for scanning banners, queue, and
  // the live decision log. This is the ONLY source of truth for queue
  // contents and the publish countdown -- nothing about the queue is ever
  // computed or guessed client-side.
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

  // Publishes a specific queued item immediately. Backend resets the
  // publish timer as part of the same operation, so the very next
  // telemetry poll (within 4s) reflects both the new feed post and the
  // freshly-reset countdown -- no client-side timer math needed.
  const publishNow = useCallback(async (postId: string) => {
    if (!agent) return;
    const response = await fetch(
      `${API}/api/agent/queue/${postId}/publish-now?agentId=${agent.id}`,
      { method: "POST" }
    );
    if (!response.ok) {
      await refresh(agent.id);
      throw new Error("Publish failed");
    }
    await refresh(agent.id);
  }, [agent, refresh]);

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
            Initialize a technology persona once. It discovers, rejects, remembers, and publishes—completely on its own.
          </p>
          <form onSubmit={initialize} className="launch-card">
            <label>
              Persona Name
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. NOVA" />
            </label>
            <label>
              Specialist Domain
              <input value={domain} onChange={(e) => setDomain(e.target.value)} required placeholder="e.g. AI safety & frontier infrastructure" />
            </label>
            <button disabled={loading}>{loading ? "INITIALIZING…" : "ACTIVATE AGENT ↗"}</button>
            {error && <p className="error">{error}</p>}
          </form>

          <div className="metrics">
            <span><b>01</b> Autonomous Persona</span>
            <span><b>24/7</b> Horizon Scan</span>
            <span><b>∞</b> Continuous Memory</span>
          </div>
        </section>
      ) : (
        <section className="console">
          <header className="console-head">
            <div>
              <p className="eyebrow">Live Editorial Node</p>
              <h1>
                {agent.name}<span>.</span>
              </h1>
              <p>{agent.domain}</p>
              {agent.personaThroughline && (
                <p style={{ fontSize: "13px", color: "var(--muted)", maxWidth: 620, marginTop: 8 }}>
                  <strong style={{ color: "var(--lime)" }}>Throughline:</strong> {agent.personaThroughline}
                </p>
              )}
            </div>
            <button className="telemetry-launch" onClick={() => setTelemetryOpen(true)}>
              ◫ THOUGHT MATRIX
            </button>
          </header>

          <div className="system-bar">
            <span>AGENT ID <code>{agent.id.slice(0, 8)}…</code></span>
            <span>MEMORY ACTIVE</span>
            <CountdownTimer
              nextPublishAt={telemetryData?.next_publish_at ?? null}
              queueSize={telemetryData?.queue_size ?? 0}
            />
            <button onClick={() => refresh(agent.id)}>REFRESH ↻</button>
          </div>

          {/* Live Scanning Status Banner */}
          {telemetryData && (
            <div className={`scanning-banner ${telemetryData.scan_status === "idle" ? "idle" : ""}`}>
              <span className="banner-pulse" />
              <span>
                {telemetryData.scan_status === "idle"
                  ? telemetryData.queue_size > 0
                    ? `WAITING TO PUBLISH — ${telemetryData.queue_size} DRAFT${telemetryData.queue_size === 1 ? "" : "S"} QUEUED, SCANNING RESUMES SHORTLY`
                    : "NO NEW CANDIDATES FROM SOURCES YET — WILL RE-CHECK SHORTLY"
                  : telemetryData.scan_status === "drafting"
                  ? `DRAFTING TAKE ON: ${telemetryData.active_source_url || "current candidate"}`
                  : `SCANNING: ${telemetryData.active_source_url || "broad web targets"} — ${telemetryData.scan_status.toUpperCase()} (${telemetryData.chunks_processed} new this pass)`}
              </span>
            </div>
          )}

          {telemetryData && telemetryData.queue.length > 0 && viewMode !== "queue" && (
            <PendingQueue queue={telemetryData.queue} />
          )}

          {/* Three-way Feed View Toggle */}
          <div className="view-toggle-bar">
            <button
              className={viewMode === "public" ? "active" : ""}
              onClick={() => setViewMode("public")}
            >
              PUBLIC PERSONA FEED
            </button>
            <button
              className={viewMode === "queue" ? "active" : ""}
              onClick={() => setViewMode("queue")}
            >
              PUBLISH QUEUE{telemetryData && telemetryData.queue_size > 0 ? ` (${telemetryData.queue_size})` : ""}
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
              {viewMode === "public" ? "Transmission Feed" : viewMode === "queue" ? "Publish Queue" : "Node Curation Log"}
            </p>
            <span>
              {viewMode === "operator" && telemetryData
                ? `LAST ${telemetryData.telemetry_window_minutes.toFixed(0)} MIN`
                : "NEWEST FIRST"}
            </span>
          </div>

          {viewMode === "public" ? (
            posts.length === 0 ? (
              <div className="empty">
                <div className="radar" />
                <h2>Scanning the Horizon</h2>
                <p>The first editorial cycle is evaluating sources and rejecting weak signals.</p>
              </div>
            ) : (
              <div className="feed">
                {posts.map((post) => (
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
                        <span>
                          NOVELTY: {post.noveltyScore != null ? `${post.noveltyScore.toFixed(1)}/10` : "N/A"}
                        </span>
                        <span>
                          CREDIBILITY: {post.credibilityScore != null ? `${post.credibilityScore.toFixed(1)}/10` : "N/A"}
                        </span>
                        <button onClick={() => speak(`${post.text}. Operational rationale: ${post.rationale}`)}>
                          🔊 LISTEN
                        </button>
                      </div>
                      <details className="rationale">
                        <summary>WHY THIS SIGNAL <b>+</b></summary>
                        <div className="rationale-body">
                          <p>
                            <strong>Persona Alignment</strong>
                            <span>
                              DOMAIN MATCH: {post.domainRelevance != null ? `${(post.domainRelevance * 10).toFixed(0)}%` : "N/A"}
                            </span>
                          </p>
                          <div className="match-bar">
                            <i style={{ width: `${post.domainRelevance != null ? post.domainRelevance * 10 : 0}%` }} />
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
          ) : viewMode === "queue" ? (
            <QueueView
              queue={telemetryData?.queue ?? []}
              nextPublishAt={telemetryData?.next_publish_at ?? null}
              onPublishNow={publishNow}
            />
          ) : (
            /* Operator Control Room View */
            !telemetryData || telemetryData.decisions.length === 0 ? (
              <div className="empty">
                <div className="radar" />
                <h2>No Recent Activity</h2>
                <p>Scanning targets or verifying candidates... entries here age out after {telemetryData?.telemetry_window_minutes.toFixed(0) ?? "a few"} minutes.</p>
              </div>
            ) : (
              <div className="feed">
                {telemetryData.decisions.map((d, index) => {
                  const isAccepted = d.decision.toLowerCase() === "accepted";
                  const overallScore = Number(d.score) || 0.0;
                  return (
                    <article key={d.source_url + index} className="post">
                      <div className="post-index">{String(index + 1).padStart(2, "0")}</div>
                      <div>
                        <div className="control-room-meta">
                          <span className={`status-badge ${isAccepted ? "published" : "rejected"}`}>
                            {isAccepted ? "● QUEUED SIGNAL" : "▲ REJECTED & FLAGGED"}
                          </span>
                          <time>
                            {new Date(d.decided_at).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short"
                            })}
                          </time>
                        </div>
                        <p className="post-text" style={{ fontSize: "17px", fontWeight: "600" }}>{d.headline}</p>

                        {d.credibility_score !== undefined && (
                          <div className="scores-grid-row">
                            <div className="micro-metric">
                              <span className="label">CREDIBILITY:</span>
                              <span className="value" style={{ color: d.credibility_score >= 8 ? "var(--lime)" : "var(--crimson)" }}>
                                {d.credibility_score.toFixed(1)}/10
                              </span>
                            </div>
                            <div className="micro-metric">
                              <span className="label">DOMAIN RELEVANCE:</span>
                              <span className="value" style={{ color: (d.domain_relevance ?? 0) >= 7 ? "var(--lime)" : "var(--crimson)" }}>
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
                            <div className="micro-metric" style={{ marginLeft: "auto", borderLeft: "1px solid var(--line)", paddingLeft: "12px" }}>
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