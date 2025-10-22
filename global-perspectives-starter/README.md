
# Global Perspectives — Starter Repo (FastAPI + Agent)

Minimal scaffold for an AI-agent-driven news aggregator focused on **today-only** coverage.

## What’s inside
- **backend/**: FastAPI app + tool implementations (NewsAPI fetch, normalize, classify, summarize, NER+geo, present).
- **agent/**: Orchestrator that plans and executes the pipeline using the tools.
- **frontend/**: Placeholder (add your React app here later).
- **tests/**: A smoke test for the agent pipeline.

## Quick start

1) Python 3.11+ recommended.

2) Install deps:
```bash
pip install -r requirements.txt
```

3) Configure environment:
- Copy `.env.example` to `.env` and fill in `NEWSAPI_KEY` and `GOOGLE_GEOCODING_KEY` (if you plan to run geocoding).

4) Run the API (dev):
```bash
uvicorn backend.api:app --reload --port 8000
```

5) Try the demo endpoint:
```bash
curl 'http://localhost:8000/api/search?q=protest&language=en'
```

> Notes:
> - The NewsAPI call is real but optional; if `NEWSAPI_KEY` is missing, the pipeline returns mocked data for local dev.
> - All summaries are **extractive-first**; LLM step is a stub ready for your LLaMA integration.

## Project structure
```
agent/
  orchestrator.py
  schemas.py
  prompts/
    coordinator.md
    qa.md
backend/
  api.py
  schemas.py
  tools/
    newsapi.py
    normalize.py
    classify.py
    summarize.py
    ner_geo.py
    present.py
  __init__.py
frontend/
  README.md
tests/
  test_agent_pipeline.py
.env.example
requirements.txt
```

## Next steps
- Add a real frontend (React + Vite). If using AppSync for topics, point the frontend to the GraphQL endpoint via Amplify (`frontend/src/utils/graphqlService.js`).
- Replace the summarizer cleanup with your LLaMA endpoint (e.g., vLLM or HF Inference).
- Harden the classifier rules and add a publisher-country mapping file.
- Add caching (Redis) and a Postgres store when you outgrow in-memory dev mode.

---

## Frontend routes & data flow (current)

- Routes
  - `/` Home: Renders Gemini topics via AppSync using `useGeminiTopics`.
  - `/map` World Map: Visualizes topics by country using topics-derived article shape.
  - Removed: `/topics-test` temporary page.

- Data flow
  - AppSync GraphQL: `frontend/src/utils/graphqlService.js` + `frontend/src/hooks/useGeminiTopics.js`.
  - Legacy REST: `frontend/src/utils/api.js` (FastAPI at `http://localhost:8000`); Map no longer uses this.
  - To use REST, run FastAPI: `uvicorn backend.api:app --reload --port 8000`.

- Notes
  - If AppSync calls fail (e.g., `net::ERR_ABORTED`), verify GraphQL endpoint, region, and API key in `graphqlService.js`.
  - Consider migrating search flows to AppSync to retire REST.
