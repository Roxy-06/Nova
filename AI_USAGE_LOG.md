AI Usage Log
==============

This file provides a concise, human-readable record of AI usage for the hackathon evaluation stages. It summarizes prompts, the subsystem that used them, and timestamps. A fuller living history of prompts and experiments is kept in Prompts.md.

Guidelines: each entry should include: timestamp (UTC), subsystem, prompt summary, key response outcome, and notes about fallbacks or errors.

Sample entries
--------------

- 2026-08-08T14:02:11Z — editorial/evaluate_candidate_llm — "Score candidate: JSON with credibility, domain_relevance, technical_depth, novelty." — Response: success (credibility 8.4, domain 7.9). Note: used GEMINI API.
- 2026-08-08T14:12:03Z — editorial/evaluate_candidate_llm — "Score candidate" — Response: 429 QuotaExceeded. Action: local rate-limiter applied, fallback to backup_score().
- 2026-08-08T15:00:00Z — persona/compose_post — "Write concise analysis in persona voice" — Response: draft generated; post persisted.

How to extend
-------------

1. When invoking an LLM-backed step, append an entry here with timestamp and the prompt id (if any).
2. If you record full prompt/response pairs, add them to `Prompts.md` and add a short pointer here.

Compliance note
---------------
This file is intended for quick review by judges; the longer `Prompts.md` contains full interactions and is maintained alongside commits that show timestamps and diffs.
