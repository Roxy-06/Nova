"use client";
import { useState } from "react";
import type { QueuedPost } from "./types";

type Props = {
  queue: QueuedPost[];
  nextPublishAt: string | null;
  onPublishNow: (postId: string) => Promise<void>;
};

// The dedicated, scrollable queue section -- separate from the small
// "up next" teaser under the scanning banner. This is where a person can
// actually browse every drafted-but-not-yet-published take and force any
// one of them live immediately, instead of only ever seeing the single
// next item. Every value rendered here comes from the real queue passed
// in via telemetry polling; nothing is hardcoded or simulated.
export function QueueView({ queue, nextPublishAt, onPublishNow }: Props) {
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  if (queue.length === 0) {
    return (
      <div className="empty">
        <div className="radar" />
        <h2>Queue Is Empty</h2>
        <p>Nothing drafted right now. As soon as a candidate clears the editorial gate, it lands here.</p>
      </div>
    );
  }

  async function handlePublish(postId: string) {
    setErrorId(null);
    setPublishingId(postId);
    try {
      await onPublishNow(postId);
    } catch {
      setErrorId(postId);
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="queue-view">
      <div className="queue-view-head">
        <span>{queue.length} draft{queue.length === 1 ? "" : "s"} waiting, ranked by score</span>
        {nextPublishAt && (
          <span>Next automatic release: {new Date(nextPublishAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        )}
      </div>
      <div className="queue-scroll">
        {queue.map((item, index) => (
          <article className="queue-item" key={item.id}>
            <div className="queue-item-head">
              <span className="queue-item-rank">#{index + 1} IN LINE</span>
              <span className="queue-item-score">
                OVERALL {item.overallScore.toFixed(1)}/10
              </span>
            </div>
            <p className="post-text" style={{ fontSize: "15px" }}>{item.text}</p>

            <div className="scores-grid-row">
              <div className="micro-metric">
                <span className="label">CREDIBILITY:</span>
                <span className="value">{item.credibilityScore != null ? `${item.credibilityScore.toFixed(1)}/10` : "N/A"}</span>
              </div>
              <div className="micro-metric">
                <span className="label">DOMAIN:</span>
                <span className="value">{item.domainRelevance != null ? `${item.domainRelevance.toFixed(1)}/10` : "N/A"}</span>
              </div>
              <div className="micro-metric">
                <span className="label">DEPTH:</span>
                <span className="value">{item.technicalDepth != null ? `${item.technicalDepth.toFixed(1)}/10` : "N/A"}</span>
              </div>
              <div className="micro-metric">
                <span className="label">NOVELTY:</span>
                <span className="value">{item.noveltyScore != null ? `${item.noveltyScore.toFixed(1)}/10` : "N/A"}</span>
              </div>
            </div>

            <div className="queue-item-footer">
              <span>Queued {new Date(item.queuedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
              <div className="sources">
                {item.sources.map((source) => (
                  <a key={source} href={source} target="_blank" rel="noreferrer">
                    SOURCE ↗
                  </a>
                ))}
              </div>
              <button
                className="publish-now-btn"
                disabled={publishingId === item.id}
                onClick={() => handlePublish(item.id)}
              >
                {publishingId === item.id ? "PUBLISHING…" : "⚡ PUBLISH NOW"}
              </button>
            </div>
            {errorId === item.id && (
              <p className="error" style={{ marginTop: 8 }}>
                Couldn&apos;t publish -- it may have just gone live automatically. Refreshing…
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}