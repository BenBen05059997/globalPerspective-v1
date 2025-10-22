
import asyncio, json, datetime, sys, os
from pathlib import Path

# Add the parent directory to the path to import backend modules
sys.path.append(str(Path(__file__).parent.parent))

from backend.tools import newsapi, normalize, classify
from backend.services.bedrock_service import BedrockService

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

async def run():
    today = datetime.date.today().isoformat()
    out_path = DATA_DIR / f"summaries_{today}.json"

    print(f"[summarize_batch] Fetching today's articles...")
    raw = await newsapi.search_today(q="*", language="en")
    norm = normalize.normalize_articles(raw)
    tagged = classify.classify_local_foreign(norm)
    
    # Initialize Bedrock service for AI-powered summarization
    print(f"[summarize_batch] Initializing AWS Bedrock service...")
    bedrock_service = BedrockService()
    
    # Use AWS Bedrock LLaMA for intelligent summarization
    print(f"[summarize_batch] Generating AI summaries using AWS Bedrock LLaMA...")
    summed = await bedrock_service.batch_process_articles(tagged, include_summary=True)

    print(f"[summarize_batch] Writing {len(summed)} AI-powered summaries to {out_path}")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(summed, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    asyncio.run(run())
