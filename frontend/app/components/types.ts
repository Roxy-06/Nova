export type FeedPost = { id: string; createdAt: string; text: string; rationale: string; sources: string[] };
export type TelemetryLog = { id: string; timestamp: string; category: "INGEST" | "SCORE" | "MEMORY" | "PUBLISH"; message: string };
export type RejectedCandidate = { id: string; title: string; reason: string; score: number };
export type TelemetryDecision = { source_url: string; headline: string; topic_key: string; decision: string; reason: string; score: string; decided_at: string };
