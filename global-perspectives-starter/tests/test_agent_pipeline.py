
import asyncio
from agent.orchestrator import run_pipeline

def test_pipeline_smoke():
    res = asyncio.run(run_pipeline("protest", language="en"))
    assert "stacks" in res
    assert isinstance(res["stacks"], list)
    # With no NEWSAPI_KEY, mocked data should appear
    assert len(res["stacks"]) >= 1
