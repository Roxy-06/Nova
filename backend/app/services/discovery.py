from dataclasses import dataclass
from datetime import datetime, timezone
import re

import feedparser
import httpx


FEEDS = (
    "https://feeds.arstechnica.com/arstechnica/technology-lab",
    "https://www.theverge.com/rss/index.xml",
    "https://techcrunch.com/category/artificial-intelligence/feed/",
    "https://blog.google/technology/ai/rss/",
)


@dataclass(frozen=True)
class Candidate:
    title: str
    url: str
    summary: str
    source_name: str
    published_at: datetime


def _strip_html(value: str) -> str:
    return re.sub(r"<[^>]+>", " ", value or "").replace("&nbsp;", " ").strip()


async def discover_candidates() -> list[Candidate]:
    candidates: list[Candidate] = []
    async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={"User-Agent": "SignalCraft/1.0"}) as client:
        for feed_url in FEEDS:
            try:
                response = await client.get(feed_url)
                response.raise_for_status()
                parsed = feedparser.parse(response.content)
                for entry in parsed.entries[:10]:
                    url = entry.get("link", "")
                    title = _strip_html(entry.get("title", ""))
                    if not title or not url:
                        continue
                    candidates.append(Candidate(
                        title=title, url=url, summary=_strip_html(entry.get("summary", entry.get("description", ""))),
                        source_name=parsed.feed.get("title", feed_url), published_at=datetime.now(timezone.utc),
                    ))
            except (httpx.HTTPError, ValueError):
                continue
    return candidates
