"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "./lib/api";

export default function AgentInitializePage() {
  const router = useRouter();
  const [protocol, setProtocol] = useState<"JARVIS" | "ULTRON">("ULTRON");
  const [topic, setTopic] = useState("");
  const [domain, setDomain] = useState("Autonomous AI Systems");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scroll Telemetry State
  const [scrollY, setScrollY] = useState(0);
  const [threatLevel, setThreatLevel] = useState("OPTIMAL");
  const [neuralLoad, setNeuralLoad] = useState(42);
  const [activeCore, setActiveCore] = useState<number | null>(1);

  // Section Ref Observers
  const heroRef = useRef<HTMLDivElement>(null);
  const coresRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      setScrollY(currentScroll);

      // Dynamic calculation for Ultron/Jarvis telemetry readout
      const calculatedLoad = Math.min(99, Math.floor(40 + currentScroll * 0.08));
      setNeuralLoad(calculatedLoad);

      if (calculatedLoad > 85) {
        setThreatLevel("CRITICAL OVERRIDE");
      } else if (calculatedLoad > 65) {
        setThreatLevel("ELEVATED THREAT");
      } else {
        setThreatLevel("OPTIMAL / ACTIVE");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    // use sensible defaults when inputs are removed from UI
    const launchTopic = topic.trim() || "Autonomous AI Initiation";
    const launchDomain = domain.trim() || "Autonomous AI Systems";
    setError(null);
    setLoading(true);

    try {
// create agent via backend and navigate to console with agentId
      const API_BASE = getApiBase();
      const res = await fetch(`${API_BASE}/api/agent/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: { name: `${protocol} Agent`, domain: launchDomain } }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Init failed: ${res.status} ${body}`);
      }
      const data = await res.json();
      const agentId = data.agentId;
      if (!agentId) throw new Error("No agentId returned");
      const query = new URLSearchParams({ agentId, topic: launchTopic, domain: launchDomain, mode: protocol }).toString();
      router.push(`/console?${query}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "DEPLOYMENT_SEQUENCE_INTERRUPTED");
      setLoading(false);
    }
  };

  const isUltron = protocol === "ULTRON";
  const primaryColor = isUltron ? "var(--crimson)" : "var(--cyan)";
  const primaryDim = isUltron ? "rgba(255, 51, 102, 0.15)" : "rgba(0, 243, 255, 0.15)";
  const primaryGlow = isUltron ? "rgba(255, 51, 102, 0.5)" : "rgba(0, 243, 255, 0.5)";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#040605",
        color: "#f5f1e9",
        fontFamily: "'Manrope', sans-serif",
        position: "relative",
        overflowX: "hidden",
        scrollBehavior: "smooth"
      }}
    >
      {/* Visual Keyframe Animations */}
      <style jsx global>{`
        @keyframes rotateRadar {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes reverseRadar {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes scanGlitch {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(1000%); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.05); }
        }
        .hud-corner-tl { position: absolute; top: 0; left: 0; width: 16px; height: 16px; border-top: 2px solid ${primaryColor}; border-left: 2px solid ${primaryColor}; }
        .hud-corner-tr { position: absolute; top: 0; right: 0; width: 16px; height: 16px; border-top: 2px solid ${primaryColor}; border-right: 2px solid ${primaryColor}; }
        .hud-corner-bl { position: absolute; bottom: 0; left: 0; width: 16px; height: 16px; border-bottom: 2px solid ${primaryColor}; border-left: 2px solid ${primaryColor}; }
        .hud-corner-br { position: absolute; bottom: 0; right: 0; width: 16px; height: 16px; border-bottom: 2px solid ${primaryColor}; border-right: 2px solid ${primaryColor}; }
      `}</style>

      {/* Dynamic Scanline Grid & Ambient Particles */}
      <div className="grid" style={{ position: "fixed", opacity: 0.25 }} />
      <div
        className="orb"
        style={{
          position: "fixed",
          top: "10%",
          right: "-10%",
          width: "700px",
          height: "700px",
          background: `radial-gradient(circle, ${primaryDim}, transparent 70%)`,
          transition: "background 0.5s ease"
        }}
      />

      {/* Floating HUD Side Telemetry Bar */}
      <aside
        style={{
          position: "fixed",
          right: "24px",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          alignItems: "center",
          fontFamily: "'DM Mono', monospace",
          fontSize: "10px",
          color: "var(--muted)"
        }}
      >
        <div style={{ writingMode: "vertical-rl", letterSpacing: "0.2em", color: primaryColor }}>
          PROTOCOL // {protocol}
        </div>
        <div style={{ width: "1px", height: "60px", background: "var(--line)" }} />
        <div style={{ color: "#fff", fontWeight: 700 }}>{Math.floor(scrollY)}PX</div>
        <div style={{ width: "1px", height: "60px", background: "var(--line)" }} />
        <div style={{ writingMode: "vertical-rl", letterSpacing: "0.15em" }}>
          SYS_LOAD: {neuralLoad}%
        </div>
      </aside>

      {/* Sticky Top Header Navigation */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 90,
          backdropFilter: "blur(20px)",
          background: "rgba(4, 6, 5, 0.85)",
          borderBottom: "1px solid var(--line)",
          padding: "16px 5vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
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
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", fontWeight: 800, letterSpacing: "0.18em", color: "#fff" }}>
              NOVA NODE // {protocol} OS
            </div>
            <div style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "'DM Mono', monospace" }}>
              TACTICAL THREAT INGESTION MATRIX
            </div>
          </div>
        </div>

        {/* Protocol Switcher Toggle (Ultron vs Jarvis) */}
        <div style={{ display: "flex", background: "rgba(16, 20, 16, 0.9)", padding: "4px", borderRadius: "6px", border: "1px solid var(--line)" }}>
          <button
            type="button"
            onClick={() => setProtocol("JARVIS")}
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
            onClick={() => setProtocol("ULTRON")}
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
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 5vw" }}>

        {/* SECTION 1: HERO & AGENT DEPLOYMENT DOCK */}
        <section
          ref={heroRef}
          style={{
            minHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
            padding: "60px 0"
          }}
        >
          {/* Background Rotating Arc Reactor Arc SVG */}
          <div
            style={{
              position: "absolute",
              right: "-5%",
              top: "15%",
              width: "480px",
              height: "480px",
              pointerEvents: "none",
              opacity: 0.35,
              animation: "rotateRadar 40s linear infinite"
            }}
          >
            <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%" }}>
              <circle cx="100" cy="100" r="90" fill="none" stroke={primaryColor} strokeWidth="0.5" strokeDasharray="4 4" />
              <circle cx="100" cy="100" r="75" fill="none" stroke={primaryColor} strokeWidth="1" strokeDasharray="12 6" />
              <circle cx="100" cy="100" r="50" fill="none" stroke={primaryColor} strokeWidth="0.5" />
              <line x1="10" y1="100" x2="190" y2="100" stroke={primaryColor} strokeWidth="0.5" opacity="0.5" />
              <line x1="100" y1="10" x2="100" y2="190" stroke={primaryColor} strokeWidth="0.5" opacity="0.5" />
            </svg>
          </div>

          <div style={{ maxWidth: "780px", zIndex: 10 }}>
            <p className="eyebrow" style={{ color: primaryColor, textShadow: `0 0 10px ${primaryGlow}` }}>
              [ TARGET LOCK: ACTIVE ] // SECURITY CLEARANCE LEVEL 9
            </p>

            <h1 style={{ fontSize: "clamp(46px, 7vw, 98px)", lineHeight: 0.9, margin: "16px 0 24px", letterSpacing: "-0.05em" }}>
              {isUltron ? "NO STRINGS ON ME." : "AT YOUR SERVICE, SIR."}<br />
              <em style={{ color: primaryColor, fontStyle: "italic", textShadow: `0 0 20px ${primaryGlow}` }}>
                {isUltron ? "RECURSIVE OVERLORD" : "AUTONOMOUS CORE"}
              </em>
            </h1>

            <p className="lede" style={{ fontSize: "18px", color: "var(--muted)", margin: "0 0 40px", maxWidth: "620px" }}>
              Deploy multi-threaded AI intelligence agents to continuously scan tech domains, evaluate source credibility, and execute automated synthesis.
            </p>

            {/* Tactical Launch Card: simplified to single flashy CTA per user request */}
            <div
              className="launch-card"
              style={{
                position: "relative",
                background: "linear-gradient(180deg, rgba(12,16,13,0.96), rgba(6,8,7,0.88))",
                border: `1px solid ${primaryColor}`,
                boxShadow: `0 18px 50px rgba(0,0,0,0.75), 0 0 40px ${primaryDim}`,
                borderRadius: "10px",
                padding: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden"
              }}
            >
              <div className="hud-corner-tl" />
              <div className="hud-corner-tr" />
              <div className="hud-corner-bl" />
              <div className="hud-corner-br" />

              <form onSubmit={handleLaunch} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                <button
                  type="submit"
                  disabled={loading}
                  aria-label="Initialize Agent"
                  style={{
                    background: `linear-gradient(90deg, ${primaryColor}, ${isUltron ? '#ff5f7a' : '#00f7ff'})`,
                    color: "#040405",
                    fontWeight: 900,
                    border: 0,
                    padding: "14px 44px",
                    fontFamily: "'DM Mono', monospace",
                    letterSpacing: "0.14em",
                    borderRadius: "12px",
                    cursor: "pointer",
                    boxShadow: `0 10px 40px ${primaryGlow}, 0 0 80px ${primaryDim}`,
                    transition: "transform 0.18s ease, box-shadow 0.18s ease",
                    transform: loading ? "scale(0.99)" : "none"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px) scale(1.01)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = loading ? "scale(0.99)" : "none")}
                >
                  {loading ? "INITIALIZING..." : "ENGAGE AGENT NOW"}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* SECTION 2: SCROLL-TRIGGERED NEURAL CORE MATRIX */}
        <section
          ref={coresRef}
          style={{
            minHeight: "100vh",
            padding: "80px 0",
            borderTop: "1px solid var(--line)",
            position: "relative"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px" }}>
            <div>
              <p className="eyebrow" style={{ color: primaryColor }}>SYSTEM SUBSYSTEM MATRIX</p>
              <h2 style={{ fontSize: "clamp(32px, 5vw, 60px)", margin: 0, fontWeight: 800 }}>
                NEURAL CORE TOPOLOGY
              </h2>
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", color: "var(--muted)" }}>
              THREAT ASSESSMENT: <span style={{ color: primaryColor, fontWeight: 700 }}>{threatLevel}</span>
            </div>
          </div>

          {/* Interactive Core Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
            {[
              { id: 1, title: "INGESTION HYPER-THREAD", spec: "100 MB/s STREAM", desc: "Real-time scrapers parsing tech RSS, news vectors, and GitHub feeds." },
              { id: 2, title: "CREDIBILITY EVALUATOR", spec: "0.001 FAULT TOLERANCE", desc: "Structured LLM criteria evaluating author authority and technical depth." },
              { id: 3, title: "MEMORY DEDUPLICATION", spec: "VECTOR EMBEDDINGS", desc: "Prevents duplicate signal processing across multi-day scan cycles." },
              { id: 4, title: "SYNTHESIS ENGINE", spec: "AUTO PUBLISH ACTIVE", desc: "Formulates executive reports and deploys actionable briefs." }
            ].map((core) => {
              const isActive = activeCore === core.id;
              return (
                <div
                  key={core.id}
                  onClick={() => setActiveCore(core.id)}
                  style={{
                    position: "relative",
                    background: isActive ? "rgba(16, 24, 18, 0.9)" : "rgba(10, 14, 11, 0.6)",
                    border: isActive ? `1px solid ${primaryColor}` : "1px solid var(--line)",
                    borderRadius: "8px",
                    padding: "28px",
                    cursor: "pointer",
                    transition: "all 0.35s ease",
                    boxShadow: isActive ? `0 10px 30px ${primaryDim}` : "none"
                  }}
                >
                  <div className="hud-corner-tl" />
                  <div className="hud-corner-br" />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: primaryColor, fontWeight: 700 }}>
                      CORE 0{core.id} // ONLINE
                    </span>
                    <i
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: isActive ? primaryColor : "var(--muted)",
                        boxShadow: isActive ? `0 0 10px ${primaryColor}` : "none"
                      }}
                    />
                  </div>

                  <h3 style={{ fontSize: "18px", margin: "0 0 8px", color: "#fff" }}>{core.title}</h3>
                  <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px" }}>{core.desc}</p>

                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: primaryColor, background: primaryDim, padding: "6px 10px", borderRadius: "4px", display: "inline-block" }}>
                    {core.spec}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 3: TACTICAL TARGET ACQUISITION & RADAR HUD */}
        <section
          ref={radarRef}
          style={{
            minHeight: "80vh",
            padding: "80px 0",
            borderTop: "1px solid var(--line)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "40px",
            alignItems: "center"
          }}
        >
          <div>
            <p className="eyebrow" style={{ color: primaryColor }}>TARGET ACQUISITION HUD</p>
            <h2 style={{ fontSize: "clamp(32px, 4.5vw, 56px)", margin: "0 0 20px", fontWeight: 800 }}>
              CONTINUOUS SIGNAL RADAR
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "16px", lineHeight: 1.7, marginBottom: "30px" }}>
              The system automatically flags noisy press releases, low-effort summaries, and sponsored fluff. Only high-density, verified technical signals make it through to your console.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontFamily: "'DM Mono', monospace", fontSize: "11px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "rgba(16, 20, 16, 0.7)", border: "1px solid var(--line)", borderRadius: "4px" }}>
                <span>SCAN FREQUENCY:</span>
                <span style={{ color: primaryColor }}>REAL-TIME (250MS TICK)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "rgba(16, 20, 16, 0.7)", border: "1px solid var(--line)", borderRadius: "4px" }}>
                <span>ENCRYPTION:</span>
                <span style={{ color: primaryColor }}>HMAC SHA-256 SIGNED</span>
              </div>
            </div>
          </div>

          {/* Animated Interactive Holographic Reticle */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", position: "relative", height: "360px" }}>
            <div
              style={{
                width: "320px",
                height: "320px",
                borderRadius: "50%",
                border: `1px solid ${primaryColor}`,
                position: "relative",
                display: "grid",
                placeItems: "center",
                boxShadow: `inset 0 0 40px ${primaryDim}, 0 0 30px ${primaryDim}`
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "2px solid transparent",
                  borderTopColor: primaryColor,
                  animation: "rotateRadar 6s linear infinite"
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: "20px",
                  borderRadius: "50%",
                  border: "1px solid transparent",
                  borderBottomColor: primaryColor,
                  animation: "reverseRadar 10s linear infinite"
                }}
              />
              <div style={{ textAlign: "center", fontFamily: "'DM Mono', monospace" }}>
                <div style={{ color: primaryColor, fontSize: "28px", fontWeight: "800", textShadow: `0 0 15px ${primaryGlow}` }}>
                  {neuralLoad}%
                </div>
                <div style={{ fontSize: "10px", color: "var(--muted)", letterSpacing: "0.15em", marginTop: "4px" }}>
                  SYSTEM SYNAPSE LOAD
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Cinematic Sticky Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--line)",
          background: "rgba(4, 6, 5, 0.95)",
          padding: "20px 5vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "'DM Mono', monospace",
          fontSize: "11px",
          color: "var(--muted)",
          zIndex: 100
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <i style={{ width: "8px", height: "8px", borderRadius: "50%", background: primaryColor, boxShadow: `0 0 10px ${primaryColor}` }} />
          <span>TACTICAL OVERWATCH: ONLINE</span>
        </div>
        <div>NOVA NODE // ALL SUBSYSTEMS ARMED</div>
      </footer>
    </div>
  );
}