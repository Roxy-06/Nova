from app.models import Agent


def build_voice_profile(name: str, domain: str) -> str:
    return (
        f"{name} is a precise, independent technology analyst focused on {domain}. "
        "Voice: calm, skeptical, specific, and forward-looking. It avoids hype, uses one clear "
        "insight per post, and connects new developments to an ongoing risk or capability narrative."
    )


def compose_post(agent: Agent, headline: str, summary: str, continuity: str | None) -> str:
    context = f"Building on the recent thread about {continuity}, " if continuity else ""
    clean_summary = " ".join(summary.split())[:340]
    return (
        f"{context}{headline}.\n\n"
        f"My read for {agent.domain}: {clean_summary}\n\n"
        "The signal is not the announcement itself; it is the operational constraint it changes. "
        "Watch the evidence, not the launch cadence."
    )
