"""
NewsData.io API service for fetching real conflict and international news.
Provides 500 free API calls per day with access to 50,000+ news sources.
"""

import os
import datetime as dt
# Deprecated: external HTTP client removed to enforce Gemini-only pipeline
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

NEWSDATA_ENDPOINT = "https://newsdata.io/api/1/news"

# Keywords for conflict and international news filtering
CONFLICT_KEYWORDS = [
    "conflict", "war", "crisis", "tension", "military", "peace", "security", 
    "violence", "terrorism", "sanctions", "diplomacy", "international", 
    "geopolitical", "border", "refugee", "humanitarian", "ceasefire",
    "invasion", "occupation", "protest", "revolution", "coup", "election",
    "trade war", "nuclear", "missile", "defense", "alliance", "treaty"
]

# Countries and regions of interest for international news
PRIORITY_COUNTRIES = [
    "US", "CN", "RU", "IN", "BR", "GB", "FR", "DE", "JP", "KR", 
    "IR", "SA", "TR", "EG", "ZA", "NG", "KE", "AU", "CA", "MX",
    "UA", "IL", "PK", "BD", "ID", "TH", "VN", "PH", "MY", "SG"
]

class NewsDataService:
    def __init__(self):
        self.api_key = os.getenv("NEWSDATA_API_KEY")
        self.base_url = NEWSDATA_ENDPOINT
        
    def _is_api_key_valid(self) -> bool:
        """Check if we have a valid API key"""
        return self.api_key and self.api_key != "your_newsdata_api_key_here"
    
    def _build_search_query(self, user_query: str) -> str:
        """Build an enhanced search query for conflict/international news"""
        # If user query contains conflict-related terms, use it directly
        user_lower = user_query.lower()
        if any(keyword in user_lower for keyword in CONFLICT_KEYWORDS):
            return user_query
        
        # Otherwise, enhance with conflict keywords
        enhanced_query = f"{user_query} AND ({' OR '.join(CONFLICT_KEYWORDS[:10])})"
        return enhanced_query
    
    async def get_todays_headlines(
        self, 
        language: str = "en", 
        size: int = 10,
        category: str = None
    ) -> List[Dict[str, Any]]:
        """
        Get today's top headlines without search query
        
        Args:
            language: Language code (default: en)
            size: Number of articles to fetch (max 50 for free tier)
            category: News category filter
            
        Returns:
            List of normalized article dictionaries
        """
        # Removed external and mock support. Use Gemini/AppSync news pipeline.
        raise RuntimeError("NewsDataService.get_todays_headlines removed; use Gemini/AppSync sources")

    async def search_news(
        self, 
        query: str, 
        language: str = "en", 
        size: int = 50,
        category: str = None
    ) -> List[Dict[str, Any]]:
        """
        Search for news using NewsData.io API
        
        Args:
            query: Search query
            language: Language code (default: en)
            size: Number of articles to fetch (max 50 for free tier)
            category: News category filter
            
        Returns:
            List of normalized article dictionaries
        """
        # Removed external and mock support. Use Gemini/AppSync news pipeline.
        raise RuntimeError("NewsDataService.search_news removed; use Gemini/AppSync sources")
    
    def _normalize_article(self, article: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize NewsData.io article format to match our expected format
        """
        # NewsData.io format -> Our format
        normalized = {
            "source": {
                "id": article.get("source_id", "unknown"),
                "name": article.get("source_name", "Unknown Source")
            },
            "source_name": article.get("source_name", "Unknown Source"),
            "author": article.get("creator", ["Unknown"])[0] if article.get("creator") else "Unknown",
            "title": article.get("title", ""),
            "description": article.get("description", ""),
            "url": article.get("link", ""),
            "urlToImage": article.get("image_url"),
            "publishedAt": article.get("pubDate", dt.datetime.utcnow().isoformat() + "Z"),
            "content": article.get("content", article.get("description", "")),
            "language": article.get("language", "en"),
            "country": article.get("country", ["unknown"])[0] if article.get("country") else "unknown",
            "category": article.get("category", ["general"])[0] if article.get("category") else "general",
            "keywords": article.get("keywords", []),
        }
        
        return normalized
    
    # Mock headlines helper removed

    # Mock search helper removed

# Global instance
newsdata_service = NewsDataService()