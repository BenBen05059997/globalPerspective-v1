
from typing import List, Dict, Any
from collections import defaultdict
from .classify import analyze_article_diversity
from .publisher_mapping import publisher_service

def stack_by_country(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Enhanced country stacking with metadata and statistics"""
    # Group by origin_country_guess; then split into local vs foreign buckets.
    by_origin = defaultdict(list)
    for article in articles:
        origin = article.get("origin_country_guess") or "UNK"
        by_origin[origin].append(article)
    
    stacks = []
    for origin, items in by_origin.items():
        local = [x for x in items if x.get("classification") == "local"]
        foreign_by_country = defaultdict(list)
        regional = [x for x in items if x.get("classification") == "regional"]
        neutral = [x for x in items if x.get("classification") == "neutral"]
        
        for article in items:
            if article.get("classification") == "foreign":
                publisher_country = article.get("publisher_country") or "UNK"
                foreign_by_country[publisher_country].append(article)
        
        # Calculate statistics for this origin country
        total_articles = len(items)
        credibility_scores = [x.get("credibility_score", 50) for x in items]
        avg_credibility = sum(credibility_scores) / len(credibility_scores) if credibility_scores else 50
        
        # Get country metadata
        origin_info = publisher_service.get_country_info(origin) if origin != "UNK" else None
        
        stack_data = {
            "origin_country": origin,
            "origin_country_name": origin_info.name if origin_info else origin,
            "origin_country_flag": origin_info.flag if origin_info else "🌍",
            "origin_region": origin_info.region if origin_info else "Unknown",
            "local": local,
            "foreign_by_country": dict(foreign_by_country),
            "regional": regional,
            "neutral": neutral,
            "statistics": {
                "total_articles": total_articles,
                "local_count": len(local),
                "foreign_count": sum(len(articles) for articles in foreign_by_country.values()),
                "regional_count": len(regional),
                "neutral_count": len(neutral),
                "average_credibility": round(avg_credibility, 1),
                "unique_foreign_countries": len(foreign_by_country),
                "coverage_diversity": len(set(x.get("publisher_country") for x in items if x.get("publisher_country")))
            }
        }
        
        # Add foreign country metadata
        enhanced_foreign = {}
        for country_code, country_articles in foreign_by_country.items():
            country_info = publisher_service.get_country_info(country_code)
            enhanced_foreign[country_code] = {
                "articles": country_articles,
                "country_name": country_info.name if country_info else country_code,
                "country_flag": country_info.flag if country_info else "🌍",
                "region": country_info.region if country_info else "Unknown",
                "article_count": len(country_articles),
                "avg_credibility": round(sum(x.get("credibility_score", 50) for x in country_articles) / len(country_articles), 1) if country_articles else 50
            }
        
        stack_data["foreign_by_country_enhanced"] = enhanced_foreign
        stacks.append(stack_data)
    
    # Sort stacks by total article count (descending)
    stacks.sort(key=lambda x: x["statistics"]["total_articles"], reverse=True)
    return stacks

def generate_perspective_summary(articles: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate comprehensive perspective analysis summary"""
    if not articles:
        return {
            "total_articles": 0,
            "perspective_breakdown": {},
            "country_coverage": {},
            "credibility_analysis": {},
            "diversity_metrics": {}
        }
    
    # Basic counts
    total_articles = len(articles)
    
    # Classification breakdown
    classifications = defaultdict(int)
    for article in articles:
        classification = article.get("classification", "unknown")
        classifications[classification] += 1
    
    # Country coverage analysis
    publisher_countries = defaultdict(int)
    origin_countries = defaultdict(int)
    
    for article in articles:
        pub_country = article.get("publisher_country")
        if pub_country:
            publisher_countries[pub_country] += 1
        
        origin_country = article.get("origin_country_guess")
        if origin_country:
            origin_countries[origin_country] += 1
    
    # Credibility analysis
    credibility_scores = [article.get("credibility_score", 50) for article in articles]
    credibility_categories = defaultdict(int)
    
    for article in articles:
        category = article.get("credibility_category", "unknown")
        credibility_categories[category] += 1
    
    # Wire services and state-controlled analysis
    wire_services = sum(1 for article in articles if article.get("is_wire_service", False))
    state_controlled = sum(1 for article in articles if article.get("is_state_controlled", False))
    
    # Use the diversity analysis function
    diversity_metrics = analyze_article_diversity(articles)
    
    return {
        "total_articles": total_articles,
        "perspective_breakdown": {
            "local": classifications.get("local", 0),
            "foreign": classifications.get("foreign", 0),
            "regional": classifications.get("regional", 0),
            "neutral": classifications.get("neutral", 0)
        },
        "country_coverage": {
            "unique_publisher_countries": len(publisher_countries),
            "unique_origin_countries": len(origin_countries),
            "publisher_distribution": dict(publisher_countries),
            "origin_distribution": dict(origin_countries)
        },
        "credibility_analysis": {
            "average_score": round(sum(credibility_scores) / len(credibility_scores), 1) if credibility_scores else 0,
            "score_distribution": {
                "high": credibility_categories.get("high", 0),
                "medium": credibility_categories.get("medium", 0),
                "low": credibility_categories.get("low", 0),
                "unknown": credibility_categories.get("unknown", 0)
            },
            "wire_services": wire_services,
            "state_controlled": state_controlled
        },
        "diversity_metrics": diversity_metrics,
        "quality_indicators": {
            "geographic_diversity": len(publisher_countries) + len(origin_countries),
            "source_reliability": round((credibility_categories.get("high", 0) + credibility_categories.get("medium", 0)) / total_articles * 100, 1) if total_articles > 0 else 0,
            "perspective_balance": min(classifications.get("local", 0), classifications.get("foreign", 0)) / max(classifications.get("local", 1), classifications.get("foreign", 1)) if max(classifications.get("local", 1), classifications.get("foreign", 1)) > 0 else 0
        }
    }

def enhance_articles_metadata(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Add enhanced metadata to articles for frontend consumption"""
    enhanced_articles = []
    
    for article in articles:
        enhanced_article = article.copy()
        
        # Add formatted metadata for frontend
        publisher_country = article.get("publisher_country")
        origin_country = article.get("origin_country_guess")
        
        # Publisher metadata
        if publisher_country:
            pub_info = publisher_service.get_country_info(publisher_country)
            if pub_info:
                enhanced_article["publisher_metadata"] = {
                    "country_code": publisher_country,
                    "country_name": pub_info.name,
                    "region": pub_info.region,
                    "flag": pub_info.flag
                }
        
        # Origin metadata
        if origin_country:
            origin_info = publisher_service.get_country_info(origin_country)
            if origin_info:
                enhanced_article["origin_metadata"] = {
                    "country_code": origin_country,
                    "country_name": origin_info.name,
                    "region": origin_info.region,
                    "flag": origin_info.flag
                }
        
        # Credibility badge
        credibility_score = article.get("credibility_score", 50)
        credibility_category = article.get("credibility_category", "unknown")
        
        enhanced_article["credibility_badge"] = {
            "score": credibility_score,
            "category": credibility_category,
            "color": {
                "high": "green",
                "medium": "yellow", 
                "low": "red",
                "unknown": "gray"
            }.get(credibility_category, "gray"),
            "label": {
                "high": "High Credibility",
                "medium": "Medium Credibility",
                "low": "Low Credibility", 
                "unknown": "Unknown Source"
            }.get(credibility_category, "Unknown Source")
        }
        
        # Classification badge
        classification = article.get("classification", "unknown")
        enhanced_article["classification_badge"] = {
            "type": classification,
            "label": {
                "local": "Local Coverage",
                "foreign": "Foreign Coverage",
                "regional": "Regional Coverage",
                "neutral": "Wire Service"
            }.get(classification, "Unknown"),
            "color": {
                "local": "blue",
                "foreign": "purple",
                "regional": "orange",
                "neutral": "gray"
            }.get(classification, "gray")
        }
        
        enhanced_articles.append(enhanced_article)
    
    return enhanced_articles
