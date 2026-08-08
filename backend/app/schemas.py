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


class FeedResponse(BaseModel):
    posts: list[FeedPost]


class AgentSummary(BaseModel):
    id: str
    name: str
    domain: str
    createdAt: datetime


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


class TelemetryResponse(BaseModel):
    active_source_url: str | None = None
    scan_status: str = "idle"
    chunks_processed: int = 0
    decisions: list[TelemetryDecision]