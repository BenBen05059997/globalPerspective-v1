
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class Article(BaseModel):
    source_id: Optional[str] = None
    source_name: Optional[str] = None
    publisher_country: Optional[str] = None
    origin_country_guess: Optional[str] = None
    url: str
    title: str
    description: Optional[str] = None
    published_at: Optional[str] = None
    language: Optional[str] = None
    is_conflict: bool = False
    summary_phrases: List[str] = Field(default_factory=list)
    locations: List[Dict[str, Any]] = Field(default_factory=list)  # [{place_name, lat, lng, confidence}]
    classification: Optional[str] = None  # 'local' | 'foreign' | 'neutral'
    
    # Location detection fields
    detected_locations: Optional[Dict[str, Any]] = None
    geographic_analysis: Optional[Dict[str, Any]] = None
    location_extraction_timestamp: Optional[str] = None
    
    # Additional fields that might be added during processing
    summary: Optional[str] = None
    credibility_score: Optional[int] = None
    credibility_category: Optional[str] = None
    bias_rating: Optional[str] = None
    factual_reporting: Optional[str] = None
    publisher_type: Optional[str] = None
    is_wire_service: Optional[bool] = None
    is_state_controlled: Optional[bool] = None
    publisher_country_name: Optional[str] = None
    publisher_region: Optional[str] = None
    publisher_flag: Optional[str] = None
    origin_country_name: Optional[str] = None
    origin_region: Optional[str] = None
    origin_flag: Optional[str] = None
    publisher_metadata: Optional[Dict[str, Any]] = None
    origin_metadata: Optional[Dict[str, Any]] = None
    credibility_badge: Optional[Dict[str, Any]] = None
    classification_badge: Optional[Dict[str, Any]] = None
    
    class Config:
        extra = "allow"  # Allow additional fields not defined in the schema

class SearchResponse(BaseModel):
    origin_country: Optional[str] = None
    stacks: List[Dict[str, Any]]  # [{country:'JP', local:[Article], foreign_by_country:{'US':[Article]}}]
    map: Optional[Dict[str, Any]] = None
    trending: Optional[List[Dict[str, Any]]] = None
    disclaimer: str = "AI-generated elements — verify originals."
