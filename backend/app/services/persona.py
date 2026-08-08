import json
import logging

from app.config import get_settings
from app.models import Agent
from app.services.llm import call_gemini

logger = logging.getLogger(__name__)


def _template_persona_profile(domain: str) -> dict:
    """Deterministic fallback used when no LLM is available. Not as sharp as
    an LLM-authored persona, but still a real throughline/bias/signature
    triplet instead of nothing."""
    return {
        "throughline": f"Every story is read through one question: does this change who holds leverage in {domain}?",
        "biases": [
            "Skeptical of announcements that lead with a demo instead of a shipped product",
            "Assumes hype cycles overshoot and correction is more informative than the launch itself",
        ],
        "signature_move": "Closes by naming the one piece of evidence that would change the take, not just restating the news",
    }


async def generate_persona_profile(name: str, domain: str) -> dict:
    """Generate a one-time, persistent editorial identity for a new agent:
    a throughline it keeps returning to, a couple of declared biases (real
    editorial voices lean somewhere, they aren't neutral), and a signature
    move. Falls back to a fixed template if no LLM key is configured or the
    call fails -- this only runs once per agent, so it's cheap even under a
    tight rate limit."""
    settings = get_settings()
    if not settings.gemini_api_key:
        return _template_persona_profile(domain)

    prompt = f"""Invent a consistent editorial persona for an autonomous technology analyst named "{name}" who specializes in: {domain}.

Return a JSON object with exactly these fields:
- "throughline": one sentence describing the single thesis/lens this analyst keeps returning to across every piece they write (not generic -- specific enough to be recognizable).
- "biases": an array of 2-3 short, specific, declared leanings or blind spots this analyst consistently has (real editorial voices are not neutral -- give them one).
- "signature_move": one sentence describing a habitual technique this analyst uses when closing a piece (e.g. always naming what would change their mind, always tying it back to a past prediction, always asking who benefits).

Respond with ONLY the JSON object, no other text."""

    try:
        text = await call_gemini(settings.gemini_model, prompt, response_schema={
            "type": "OBJECT",
            "properties": {
                "throughline": {"type": "STRING"},
                "biases": {"type": "ARRAY", "items": {"type": "STRING"}},
                "signature_move": {"type": "STRING"},
            },
            "required": ["throughline", "biases", "signature_move"],
        })
        data = json.loads(text)
        if not data.get("throughline") or not data.get("biases"):
            raise ValueError("incomplete persona response")
        return data
    except Exception as e:
        logger.error(f"Persona generation failed, using template fallback: {e}")
        return _template_persona_profile(domain)


def build_voice_profile(name: str, domain: str, persona_profile: dict | None = None) -> str:
    base = (
        f"{name} is a precise, independent technology analyst focused on {domain}. "
        "Voice: calm, skeptical, specific, and forward-looking. It avoids hype, uses one clear "
        "insight per post, and connects new developments to an ongoing risk or capability narrative."
    )
    if not persona_profile:
        return base
    biases = "; ".join(persona_profile.get("biases", []))
    return (
        f"{base}\n"
        f"Recurring throughline: {persona_profile.get('throughline', '')}\n"
        f"Declared biases: {biases}\n"
        f"Signature closing move: {persona_profile.get('signature_move', '')}"
    )


def _template_compose_post(agent: Agent, headline: str, summary: str, continuity: str | None) -> str:
    """Old pure-template fallback -- used only when no LLM is available.
    This does not produce an opinion, just a summary; it exists so the
    pipeline still works with zero LLM budget, not as the intended output."""
    context = f"Building on the recent thread about {continuity}, " if continuity else ""
    clean_summary = " ".join(summary.split())[:340]
    return (
        f"{context}{headline}.\n\n"
        f"My read for {agent.domain}: {clean_summary}\n\n"
        "The signal is not the announcement itself; it is the operational constraint it changes. "
        "Watch the evidence, not the launch cadence."
    )


async def compose_post(
    agent: Agent,
    headline: str,
    summary: str,
    continuity: str | None,
    persona_profile: dict | None = None,
) -> str:
    """Write an actual editorial take on the article using the agent's
    persistent persona -- a stance, not a summary. Falls back to the plain
    template if no LLM key is configured or the call fails."""
    settings = get_settings()
    if not settings.gemini_api_key:
        return _template_compose_post(agent, headline, summary, continuity)

    voice = build_voice_profile(agent.name, agent.domain, persona_profile)
    continuity_line = f'This follows up on a recent piece touching on: "{continuity}".' if continuity else "This is a fresh thread, not a follow-up."

    prompt = f"""You are {agent.name}, an autonomous technology editorial voice. This is your persona:

{voice}

{continuity_line}

Here is a news item you decided is worth covering:
Headline: {headline}
Summary: {summary}

Write your take on this, in your own words, in 3-4 short paragraphs. Requirements:
- Take an actual position (skeptical, optimistic, alarmed, unimpressed -- something specific, not neutral summary).
- Do not just restate or lightly reword the headline/summary -- react to it using your throughline and biases.
- Close using your signature move.
- Do not quote the source article directly; paraphrase facts in your own words.
- Do not use markdown headers or bullet points, write flowing prose.

Respond with ONLY the post text, no preamble, no quotation marks around it."""

    try:
        text = await call_gemini(settings.gemini_model, prompt)
        text = text.strip()
        if not text:
            raise ValueError("empty response")
        return text
    except Exception as e:
        logger.error(f"Opinion generation failed, using template fallback: {e}")
        return _template_compose_post(agent, headline, summary, continuity)