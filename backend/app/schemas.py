from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class PersonaDetails(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    domain: str = Field(min_length=2, max_length=160)


class InitRequest(BaseModel):
    persona: PersonaDetails


class InitResponse(BaseModel):
    agentId: str


class FeedPost(BaseModel):
    id: str
    sequenceNumber: int
    createdAt: datetime
    text: str
    rationale: str
    sources: list[str]
    # Real scores carried over from editorial scoring at queue time. All
    # Optional/nullable because posts published before these columns existed
    # won't have them -- the frontend shows "N/A" rather than inventing a
    # number in that case. These replace what used to be a hardcoded
    # (94 - index * 2)% / (99 - index).(4 - index)% placeholder formula that
    # had no connection to the actual post.
    overallScore: float | None = None
    credibilityScore: float | None = None
    domainRelevance: float | None = None
    technicalDepth: float | None = None
    noveltyScore: float | None = None


class FeedResponse(BaseModel):
    posts: list[FeedPost]


class AgentSummary(BaseModel):
    id: str
    name: str
    domain: str
    createdAt: datetime
    personaThroughline: str | None = None
    personaBiases: list[str] = []
    personaSignatureMove: str | None = None


class TelemetryDecision(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_url: str
    headline: str
    topic_key: str
    decision: str
    reason: str
    score: str
    decided_at: datetime

    credibility_score: float | None = None
    domain_relevance: float | None = None
    technical_depth: float | None = None
    novelty_score: float | None = None
    overall_credibility_index: float | None = None


class QueuedPost(BaseModel):
    id: str
    text: str
    rationale: str
    sources: list[str]
    overallScore: float
    credibilityScore: float | None = None
    domainRelevance: float | None = None
    technicalDepth: float | None = None
    noveltyScore: float | None = None
    queuedAt: datetime


class PublishNowResponse(BaseModel):
    ok: bool
    postId: str


class TelemetryResponse(BaseModel):
    active_source_url: str | None = None
    scan_status: str = "idle"
    chunks_processed: int = 0
    decisions: list[TelemetryDecision]
    queue: list[QueuedPost] = []
    queue_size: int = 0
    next_publish_at: datetime | None = None
    # Echoed back so the frontend can label the log window accurately (e.g.
    # "last 6 min") without hardcoding that number on its own side too.
    telemetry_window_minutes: float = 6.0