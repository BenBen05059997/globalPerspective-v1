
from typing import List, Dict, Any, Optional
import re
from .publisher_mapping import publisher_service

# Enhanced country hints with more comprehensive coverage
COUNTRY_HINTS = {
    # Japan
    "tokyo": "JP", "japan": "JP", "osaka": "JP", "kyoto": "JP", "yokohama": "JP", 
    "nagoya": "JP", "sapporo": "JP", "fukuoka": "JP", "kobe": "JP", "kawasaki": "JP",
    "japanese": "JP", "nippon": "JP", "nihon": "JP",
    
    # France
    "paris": "FR", "france": "FR", "marseille": "FR", "lyon": "FR", "toulouse": "FR",
    "nice": "FR", "nantes": "FR", "strasbourg": "FR", "montpellier": "FR", "bordeaux": "FR",
    "french": "FR", "français": "FR", "française": "FR",
    
    # United Kingdom
    "london": "GB", "britain": "GB", "uk": "GB", "england": "GB", "scotland": "GB",
    "wales": "GB", "birmingham": "GB", "manchester": "GB", "glasgow": "GB", "liverpool": "GB",
    "leeds": "GB", "sheffield": "GB", "edinburgh": "GB", "bristol": "GB", "cardiff": "GB",
    "british": "GB", "english": "GB", "scottish": "GB", "welsh": "GB",
    
    # United States
    "new york": "US", "washington": "US", "america": "US", "usa": "US", "los angeles": "US",
    "chicago": "US", "houston": "US", "phoenix": "US", "philadelphia": "US", "san antonio": "US",
    "san diego": "US", "dallas": "US", "san jose": "US", "austin": "US", "jacksonville": "US",
    "american": "US", "united states": "US",
    
    # Germany
    "berlin": "DE", "germany": "DE", "hamburg": "DE", "munich": "DE", "cologne": "DE",
    "frankfurt": "DE", "stuttgart": "DE", "düsseldorf": "DE", "dortmund": "DE", "essen": "DE",
    "german": "DE", "deutschland": "DE", "deutsch": "DE",
    
    # China
    "beijing": "CN", "china": "CN", "shanghai": "CN", "guangzhou": "CN", "shenzhen": "CN",
    "tianjin": "CN", "wuhan": "CN", "dongguan": "CN", "chengdu": "CN", "nanjing": "CN",
    "chinese": "CN", "zhongguo": "CN",
    
    # India
    "mumbai": "IN", "india": "IN", "delhi": "IN", "bangalore": "IN", "hyderabad": "IN",
    "ahmedabad": "IN", "chennai": "IN", "kolkata": "IN", "surat": "IN", "pune": "IN",
    "indian": "IN", "bharat": "IN",
    
    # Russia
    "moscow": "RU", "russia": "RU", "saint petersburg": "RU", "novosibirsk": "RU",
    "yekaterinburg": "RU", "nizhny novgorod": "RU", "kazan": "RU", "chelyabinsk": "RU",
    "russian": "RU", "rossiya": "RU",
    
    # Australia
    "sydney": "AU", "australia": "AU", "melbourne": "AU", "brisbane": "AU", "perth": "AU",
    "adelaide": "AU", "gold coast": "AU", "newcastle": "AU", "canberra": "AU",
    "australian": "AU", "aussie": "AU",
    
    # Canada
    "toronto": "CA", "canada": "CA", "montreal": "CA", "calgary": "CA", "ottawa": "CA",
    "edmonton": "CA", "mississauga": "CA", "winnipeg": "CA", "vancouver": "CA",
    "canadian": "CA",
    
    # Spain
    "madrid": "ES", "spain": "ES", "barcelona": "ES", "valencia": "ES", "seville": "ES",
    "zaragoza": "ES", "málaga": "ES", "murcia": "ES", "palma": "ES", "bilbao": "ES",
    "spanish": "ES", "españa": "ES",
    
    # Italy
    "rome": "IT", "italy": "IT", "milan": "IT", "naples": "IT", "turin": "IT",
    "palermo": "IT", "genoa": "IT", "bologna": "IT", "florence": "IT", "bari": "IT",
    "italian": "IT", "italia": "IT",
    
    # Netherlands
    "amsterdam": "NL", "netherlands": "NL", "rotterdam": "NL", "the hague": "NL",
    "utrecht": "NL", "eindhoven": "NL", "tilburg": "NL", "groningen": "NL",
    "dutch": "NL", "holland": "NL",
    
    # Brazil
    "são paulo": "BR", "brazil": "BR", "rio de janeiro": "BR", "brasília": "BR",
    "salvador": "BR", "fortaleza": "BR", "belo horizonte": "BR", "manaus": "BR",
    "brazilian": "BR", "brasil": "BR",
    
    # Israel
    "jerusalem": "IL", "israel": "IL", "tel aviv": "IL", "haifa": "IL",
    "israeli": "IL",
    
    # Qatar
    "doha": "QA", "qatar": "QA", "qatari": "QA",
    
    # Hong Kong
    "hong kong": "HK", "hongkong": "HK", "kowloon": "HK",
}

def infer_origin_country(title: str, description: Optional[str], url: Optional[str] = None) -> Optional[str]:
    """Enhanced country inference with multiple data sources"""
    text = f"{title or ''} {description or ''}".lower()
    
    # First try URL-based detection
    if url:
        publisher = publisher_service.get_publisher_by_url(url)
        if publisher:
            info = publisher_service.get_publisher_info(publisher)
            if info:
                return info.country
    
    # Then try text-based hints with improved matching
    for hint, country in COUNTRY_HINTS.items():
        # Use word boundaries for better matching
        pattern = r"\b" + re.escape(hint) + r"\b"
        if re.search(pattern, text):
            return country
    
    return None

def get_credibility_info(source_name: str, url: Optional[str] = None) -> Dict[str, Any]:
    """Get comprehensive credibility information for a source"""
    # Try direct publisher lookup
    info = publisher_service.get_publisher_info(source_name)
    
    # If not found, try URL-based lookup
    if not info and url:
        publisher = publisher_service.get_publisher_by_url(url)
        if publisher:
            info = publisher_service.get_publisher_info(publisher)
    
    if info:
        return {
            "credibility_score": info.credibility_score,
            "credibility_category": publisher_service.get_credibility_category(info.credibility_score),
            "bias_rating": info.bias_rating,
            "factual_reporting": info.factual_reporting,
            "publisher_type": info.type,
            "is_wire_service": publisher_service.is_wire_service(source_name),
            "is_state_controlled": publisher_service.is_state_controlled(source_name)
        }
    
    # Default values for unknown sources
    return {
        "credibility_score": 50,
        "credibility_category": "unknown",
        "bias_rating": "unknown",
        "factual_reporting": "unknown",
        "publisher_type": "unknown",
        "is_wire_service": False,
        "is_state_controlled": False
    }

def classify_local_foreign(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Enhanced classification with comprehensive publisher mapping and credibility scoring"""
    for article in articles:
        source_name = article.get("source_name") or ""
        url = article.get("url")
        
        # Get publisher information
        publisher_info = publisher_service.get_publisher_info(source_name)
        
        # Try URL-based lookup if direct lookup fails
        if not publisher_info and url:
            publisher_name = publisher_service.get_publisher_by_url(url)
            if publisher_name:
                publisher_info = publisher_service.get_publisher_info(publisher_name)
                # Update source name if found via URL
                article["source_name"] = publisher_name
        
        # Set publisher country
        publisher_country = publisher_info.country if publisher_info else None
        article["publisher_country"] = publisher_country
        
        # Add credibility information
        credibility_info = get_credibility_info(source_name, url)
        article.update(credibility_info)
        
        # Infer origin country from content
        origin_country = infer_origin_country(
            article.get("title"), 
            article.get("description"),
            url
        )
        article["origin_country_guess"] = origin_country
        
        # Enhanced classification logic
        if publisher_info and publisher_service.is_wire_service(source_name):
            # Wire services are generally neutral
            article["classification"] = "neutral"
        elif origin_country and publisher_country:
            # Clear geographic match
            if origin_country == publisher_country:
                article["classification"] = "local"
            else:
                # Check if countries are in the same region for nuanced classification
                pub_country_info = publisher_service.get_country_info(publisher_country)
                origin_country_info = publisher_service.get_country_info(origin_country)
                
                if (pub_country_info and origin_country_info and 
                    pub_country_info.region == origin_country_info.region):
                    article["classification"] = "regional"
                else:
                    article["classification"] = "foreign"
        elif publisher_country:
            # Publisher known but origin unclear - assume foreign coverage
            article["classification"] = "foreign"
        else:
            # Unknown publisher - neutral classification
            article["classification"] = "neutral"
        
        # Add country metadata if available
        if publisher_country:
            country_info = publisher_service.get_country_info(publisher_country)
            if country_info:
                article["publisher_country_name"] = country_info.name
                article["publisher_region"] = country_info.region
                article["publisher_flag"] = country_info.flag
        
        if origin_country:
            origin_info = publisher_service.get_country_info(origin_country)
            if origin_info:
                article["origin_country_name"] = origin_info.name
                article["origin_region"] = origin_info.region
                article["origin_flag"] = origin_info.flag
    
    return articles

def analyze_article_diversity(articles: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze the diversity and quality of article sources"""
    sources = [article.get("source_name", "") for article in articles if article.get("source_name")]
    
    # Use publisher service for analysis
    diversity_analysis = publisher_service.analyze_source_diversity(sources)
    
    # Add classification breakdown
    classifications = {}
    credibility_breakdown = {"high": 0, "medium": 0, "low": 0, "unknown": 0}
    
    for article in articles:
        classification = article.get("classification", "unknown")
        classifications[classification] = classifications.get(classification, 0) + 1
        
        credibility_category = article.get("credibility_category", "unknown")
        credibility_breakdown[credibility_category] += 1
    
    diversity_analysis.update({
        "classification_breakdown": classifications,
        "credibility_breakdown": credibility_breakdown
    })
    
    return diversity_analysis
