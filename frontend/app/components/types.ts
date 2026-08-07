export type FeedPost = { id: string; createdAt: string; text: string; rationale: string; sources: string[] };
export type TelemetryLog = { id: string; timestamp: string; category: "INGEST" | "SCORE" | "MEMORY" | "PUBLISH"; message: string };
export type RejectedCandidate = { id: string; title: string; reason: string; score: number };
