# AWS Lambda Plan: Gemini Topics via Google Gemini

## Summary
- Goal: Return trending topics (no articles) from Google Gemini using AWS Lambda.
- Approach: Backend FastAPI endpoint `/api/topics/gemini` invokes Lambda and returns its JSON payload to the frontend.
- Benefit: Keeps frontend unchanged, avoids local CORS/timeouts, and centralizes secrets.

## Architecture
- Frontend: Calls `GET /api/topics/gemini`.
- Backend (FastAPI): Invokes Lambda (synchronous), returns JSON `{ topics: Topic[], ai_powered: true }`.
- AWS Lambda: Calls Google Gemini and generates topics.
- Secrets: `GOOGLE_GEMINI_API_KEY` stored in Lambda env vars or AWS Secrets Manager.

## Lambda Function (Python 3.12)
Use the following handler. It requests 5 topics and enforces strict JSON output. For faster responses, the `gemini-1.5-flash` model is used.

```python
import os
import json
import re
import logging
import google.generativeai as genai

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def _extract_json(text: str):
    text = text.strip()
    # Try direct JSON first
    try:
        return json.loads(text)
    except Exception:
        pass
    # Try fenced JSON blocks
    m = re.search(r"```json\s*(\[.*?\]|\{.*?\})\s*```", text, flags=re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    # Try first top-level array/object
    m2 = re.search(r"(\[.*\]|\{.*\})", text, flags=re.S)
    if m2:
        try:
            return json.loads(m2.group(1))
        except Exception:
            pass
    return None

def handler(event, context):
    try:
        api_key = os.environ["GOOGLE_GEMINI_API_KEY"]
    except KeyError:
        logger.error("Missing GOOGLE_GEMINI_API_KEY")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "GOOGLE_GEMINI_API_KEY not set"}),
        }

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    prompt = (
        "Return strictly a JSON array named topics: each item must have "
        "title, category, description, regions (array of strings), search_keywords (array of strings). "
        "Focus on current international and geopolitical topics. Do not include any articles or URLs. "
        "Example schema: [ {\"title\":\"...\", \"category\":\"...\", \"description\":\"...\", \"regions\":[\"...\"], \"search_keywords\":[\"...\"] } ]. "
        "Return only JSON with no commentary. Limit to 5 items."
    )

    try:
        resp = model.generate_content(prompt)
        text = (resp.text or "").strip()
        topics = _extract_json(text)
        if isinstance(topics, dict) and "topics" in topics:
            topics_list = topics["topics"]
        else:
            topics_list = topics if isinstance(topics, list) else []
    except Exception as e:
        logger.exception("Gemini call failed: %s", e)
        topics_list = []

    payload = {"topics": topics_list, "ai_powered": True}
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload),
    }
```

### Dependencies
- Package: `google-generativeai`
  - Option A: Zip deployment — include the library in the deployment package.
  - Option B: Lambda Layer — build a layer with `google-generativeai` and attach to the function.
- Runtime: Python 3.12 (or 3.11). Set timeout 15–30s, memory 512–1024MB.

### Environment Variables
- `GOOGLE_GEMINI_API_KEY`: Your Gemini API key.
- Optional: `TOPIC_COUNT` if you want to make the count configurable.

### IAM and Networking
- IAM policy must allow invoking the function from your backend if using AWS SDK.
- If Lambda is in a VPC, ensure outbound internet access via NAT Gateway for Gemini API.

## Backend Integration (FastAPI)
Invoke Lambda from your backend so the frontend keeps using `/api/topics/gemini`.

```python
# backend/services/lambda_service.py
import boto3, json, os

client = boto3.client("lambda", region_name=os.getenv("AWS_REGION", "us-east-1"))

def get_gemini_topics():
    fn = os.getenv("GEMINI_TOPICS_LAMBDA_NAME", "gemini-topics")
    resp = client.invoke(FunctionName=fn, InvocationType="RequestResponse")
    payload = resp["Payload"].read()
    data = json.loads(payload)
    # Proxy-integration format
    if isinstance(data, dict) and "body" in data:
        try:
            return json.loads(data["body"])  # { topics: [], ai_powered: True }
        except Exception:
            return {"topics": [], "ai_powered": True}
    return data
```

Update your FastAPI route:
```python
# backend/api.py
from backend.services.lambda_service import get_gemini_topics

@app.get("/api/topics/gemini")
async def get_gemini_topics_endpoint():
    try:
        return get_gemini_topics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lambda error: {str(e)}")
```

## Optional: API Gateway Direct
- Expose Lambda via API Gateway and call it directly from the frontend.
- Enable CORS on the API Gateway method to allow your dev origin.
- Replace `getGeminiTopics()` in `frontend/src/utils/api.js` to point to the Gateway URL.

## Timeouts and UX
- Frontend `apiRequest` currently uses a 30s timeout. Keep 30–60s for AI endpoints.
- Use the `gemini-1.5-flash` model for lower latency.

## Testing
- Lambda: Invoke via AWS Console or CLI, verify the response body contains `{ topics: [...] }`.
- Backend: `curl http://localhost:8000/api/topics/gemini` and confirm JSON payload.
- Frontend: Visit `http://localhost:5174/topics-test` and confirm topics render.

## Notes
- The topics-only page is intentionally minimal, focusing on validating Gemini’s discovery capability without fetching articles.
- If the response is empty, check env vars and CloudWatch logs for the Lambda.