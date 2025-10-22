
import asyncio
from typing import Dict, Any
from agent.schemas import Plan
from backend.tools import newsapi, normalize, classify, summarize, ner_geo, present

async def run_pipeline(topic: str, language: str = "en") -> Dict[str, Any]:
    plan = Plan(topic=topic, is_conflict=False, language=language)
    raw = await newsapi.search_today(q=plan.topic, language=plan.language or "en")
    norm = normalize.normalize_articles(raw)
    tagged = classify.classify_local_foreign(norm)
    summed = summarize.summarize(tagged)
    enriched = ner_geo.add_locations(summed)
    stacks = present.stack_by_country(enriched)
    return {"stacks": stacks, "disclaimer": "AI-generated elements — verify originals."}

if __name__ == "__main__":
    import json, sys
    topic = sys.argv[1] if len(sys.argv) > 1 else "protest"
    result = asyncio.run(run_pipeline(topic))
    print(json.dumps(result, indent=2))
