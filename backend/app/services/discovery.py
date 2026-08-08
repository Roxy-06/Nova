from dataclasses import dataclass
from datetime import datetime, timezone
import re
import logging
import feedparser
import httpx

logger = logging.getLogger(__name__)

SOURCES = [
    {"type": "rss", "url": "https://feeds.arstechnica.com/arstechnica/technology-lab", "name": "Ars Technica"},
    {"type": "rss", "url": "https://www.theverge.com/rss/index.xml", "name": "The Verge"},
    {"type": "rss", "url": "https://techcrunch.com/category/artificial-intelligence/feed/", "name": "TechCrunch AI"},
    {"type": "rss", "url": "https://blog.google/technology/ai/rss/", "name": "Google AI"},
    {"type": "scrape", "url": "https://news.ycombinator.com/", "name": "Hacker News"},
    {"type": "api", "url": "https://hn.algolia.com/api/v1/search?tags=front_page", "name": "HN Algolia API"}
]

@dataclass(frozen=True)
class Candidate:
    title: str
    url: str
    summary: str
    source_name: str
    published_at: datetime

def _strip_html(value: str) -> str:
    return re.sub(r"<[^>]+>", " ", value or "").replace("&nbsp;", " ").strip()

async def discover_source_candidates(client: httpx.AsyncClient, source: dict) -> list[Candidate]:
    candidates: list[Candidate] = []
    stype = source["type"]
    url = source["url"]
    name = source["name"]
    try:
        if stype == "rss":
            response = await client.get(url, timeout=12)
            response.raise_for_status()
            parsed = feedparser.parse(response.content)
            for entry in parsed.entries[:10]:
                link = entry.get("link", "")
                title = _strip_html(entry.get("title", ""))
                if not title or not link:
                    continue
                summary = _strip_html(entry.get("summary", entry.get("description", "")))
                candidates.append(Candidate(
                    title=title, url=link, summary=summary,
                    source_name=parsed.feed.get("title", name), published_at=datetime.now(timezone.utc)
                ))
        elif stype == "scrape":
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            res = await client.get(url, headers=headers, timeout=12)
            res.raise_for_status()
            html = res.text
            if "news.ycombinator.com" in url:
                matches = re.finditer(r'<span class="titleline"><a href="(?P<url>[^"]+)"[^>]*>(?P<title>[^<]+)</a>', html)
                count = 0
                for m in matches:
                    if count >= 10:
                        break
                    url_at = m.group("url")
                    title_at = _strip_html(m.group("title"))
                    if url_at.startswith("item?id="):
                        url_at = "https://news.ycombinator.com/" + url_at
                    if title_at and url_at:
                        candidates.append(Candidate(
                            title=title_at, url=url_at, summary=f"Live signal discovered on Hacker News.",
                            source_name="Hacker News (Scraped)", published_at=datetime.now(timezone.utc)
                        ))
                        count += 1
            else:
                links = re.findall(r'<a\s+[^>]*href="([^"]+)"[^>]*>([^<]{15,100})</a>', html)
                count = 0
                for link_url, link_text in links:
                    if count >= 10:
                        break
                    if link_url.startswith("http") and not any(x in link_url for x in ["facebook", "twitter", "linkedin", "google"]):
                        link_text = _strip_html(link_text)
                        candidates.append(Candidate(
                            title=link_text, url=link_url, summary=f"Web scraped source article.",
                            source_name=name, published_at=datetime.now(timezone.utc)
                        ))
                        count += 1
        elif stype == "api":
            res = await client.get(url, timeout=12)
            res.raise_for_status()
            data = res.json()
            if "hits" in data:
                for hit in data["hits"][:10]:
                    title = _strip_html(hit.get("title", ""))
                    url_val = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
                    if title:
                        summary = hit.get("story_text") or f"Discovered via Algolia Hacker News API feed."
                        candidates.append(Candidate(
                            title=title, url=url_val, summary=_strip_html(summary),
                            source_name="Hacker News API", published_at=datetime.now(timezone.utc)
                        ))
    except Exception as e:
        logger.error(f"Error fetching source {name} ({url}): {e}")
    return candidates

async def discover_candidates() -> list[Candidate]:
    candidates = []
    async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={"User-Agent": "SignalCraft/1.0"}) as client:
        for source in SOURCES:
            res = await discover_source_candidates(client, source)
            candidates.extend(res)
    return candidates
