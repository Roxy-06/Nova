export type FeedPost = {
  id: string;
  sequenceNumber: number;
  createdAt: string;
  text: string;
  rationale: string;
  sources: string[];
};

export type TelemetryLog = {
  id: string;
  timestamp: string;
  category: "INGEST" | "SCORE" | "MEMORY" | "PUBLISH";
  message: string;
};

export type RejectedCandidate = {
  id: string;
  title: string;
  reason: string;
  score: number;
  credibility_score?: number;
  domain_relevance?: number;
  technical_depth?: number;
  novelty_score?: number;
};

export type TelemetryDecision = {
  source_url: string;
  headline: string;
  topic_key: string;
  decision: string;
  reason: string;
  score: string;
  decided_at: string;
  
  credibility_score?: number;
  domain_relevance?: number;
  technical_depth?: number;
  novelty_score?: number;
  overall_credibility_index?: number;
};

export type QueuedPost = {
  id: string;
  text: string;
  sources: string[];
  overallScore: number;
  queuedAt: string;
};

export type TelemetryResponse = {
  active_source_url: string | null;
  scan_status: string;
  chunks_processed: number;
  decisions: TelemetryDecision[];
  queue: QueuedPost[];
  queue_size: number;
  next_publish_at: string | null;
};