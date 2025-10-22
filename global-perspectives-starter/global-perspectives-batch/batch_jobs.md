
# Batch Jobs for Global Perspectives

This folder adds two Python scripts to support **cost-efficient summarization and predictions**.

## 1. `summarize_batch.py`
- Fetches today's articles via `newsapi.py`.
- Normalizes, deduplicates, and classifies them (local vs. foreign).
- Generates 3–5 neutral summary phrases using `summarize.py`.
- Saves results to `data/summaries_<YYYY-MM-DD>.json`.

**Run:**  
```bash
python summarize_batch.py
```

## 2. `predict_batch.py`
- Loads today's summaries from the `data/` folder.
- For conflict-tagged articles, generates **cause/effect predictions** (stubbed for now).
- Saves results to `data/predictions_<YYYY-MM-DD>.json`.

**Run:**  
```bash
python predict_batch.py
```

## 3. Workflow
1. `summarize_batch.py` → creates daily summaries.
2. `predict_batch.py` → adds predictions for conflict topics.
3. API or chatbot can then **read precomputed JSON files** instead of calling the LLM live for each user request.

## 4. Benefits
- **Batch jobs use cheaper Bedrock batch mode** (≈50% savings vs on-demand).
- Ensures summaries/predictions are **fresh and cached**.
- Reduces token costs and latency for the interactive chatbot.

## 5. Next Steps
- Replace stub predictions with real Bedrock (Llama) or OpenAI (o4-mini) client.
- Store results in a database (Postgres) instead of flat JSON files for scale.
- Schedule scripts to run every 15–30 minutes (cron, AWS Batch, ECS, etc.).
