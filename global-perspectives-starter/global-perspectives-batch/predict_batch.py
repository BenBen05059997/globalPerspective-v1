
import asyncio, json, datetime, sys
from pathlib import Path

# Add the parent directory to the path to import backend modules
sys.path.append(str(Path(__file__).parent.parent))

from backend.services.bedrock_service import BedrockService

async def run():
    today = datetime.date.today().isoformat()
    in_path = Path("data") / f"summaries_{today}.json"
    out_path = Path("data") / f"predictions_{today}.json"

    if not in_path.exists():
        print(f"[predict_batch] No summaries found at {in_path}")
        return

    with open(in_path, "r", encoding="utf-8") as f:
        articles = json.load(f)

    # Initialize Bedrock service for AI-powered predictions
    print(f"[predict_batch] Initializing AWS Bedrock service...")
    bedrock_service = BedrockService()

    # Filter articles that need predictions (conflict-related)
    conflict_articles = [art for art in articles if art.get("is_conflict")]
    
    if not conflict_articles:
        print(f"[predict_batch] No conflict articles found for predictions")
        return

    print(f"[predict_batch] Generating AI predictions for {len(conflict_articles)} conflict articles using AWS Bedrock LLaMA...")
    
    # Generate predictions using AWS Bedrock LLaMA
    preds = []
    for art in conflict_articles:
        try:
            prediction = await bedrock_service.generate_predictions(art)
            if prediction:
                preds.append(prediction)
        except Exception as e:
            print(f"[predict_batch] Error generating prediction for article '{art.get('title', 'unknown')}': {e}")
            continue

    print(f"[predict_batch] Writing {len(preds)} AI-powered predictions to {out_path}")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(preds, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    asyncio.run(run())
