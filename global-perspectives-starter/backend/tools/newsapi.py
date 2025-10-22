
from typing import List, Dict, Any
# Removed mock and external API usage; use Gemini/AppSync pipeline instead

def _recent_range_utc():
    raise RuntimeError("newsapi._recent_range_utc removed; use Gemini/AppSync sources")

async def get_todays_headlines(language: str = "en") -> List[Dict[str, Any]]:
    """
    Removed mock and external API support. Use Gemini/AppSync news pipeline.
    """
    raise RuntimeError("newsapi.get_todays_headlines removed; use Gemini/AppSync sources")

async def search_today(q: str, language: str = "en", page: int = 1) -> List[Dict[str, Any]]:
    """
    Removed mock and external API support. Use Gemini/AppSync news pipeline.
    """
    raise RuntimeError("newsapi.search_today removed; use Gemini/AppSync sources")
