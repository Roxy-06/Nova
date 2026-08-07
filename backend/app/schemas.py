from datetime import datetime

from pydantic import BaseModel, Field


class InitRequest(BaseModel):
    personaName: str = Field(min_length=2, max_length=100)
    domain: str = Field(min_length=2, max_length=160)


class InitResponse(BaseModel):
    agentId: str


class FeedPost(BaseModel):
    id: str
    createdAt: datetime
    text: str
    rationale: str
    sources: list[str]


class AgentSummary(BaseModel):
    id: str
    name: str
    domain: str
    createdAt: datetime
