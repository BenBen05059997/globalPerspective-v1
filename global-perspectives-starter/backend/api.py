
import os
from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

from fastapi import FastAPI, HTTPException, Query, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import asyncio

from backend.schemas import SearchResponse
from backend.tools import newsapi, normalize, classify, summarize, ner_geo, present
from backend.services.bedrock_service import bedrock_service
from backend.services.lambda_service import lambda_service
from backend.services.ai_orchestrator import ai_orchestrator
app = FastAPI(title="Global Perspectives API", version="0.1.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/healthz")
async def healthz():
    return {"ok": True}

# Gemini-only topics endpoint (no articles fetched)
@app.get("/api/topics/gemini")
async def get_gemini_topics():
    try:
        from backend.services.gemini_verification_service import gemini_verification
        topics = gemini_verification.discover_trending_topics()
        return {"topics": topics, "ai_powered": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching Gemini topics: {str(e)}")

@app.get("/api/headlines", response_model=SearchResponse)
async def get_headlines(language: Optional[str] = "en"):
    """Get today's top headlines using AI-powered discovery"""
    try:
        # Use AI orchestrator for intelligent news discovery
        ai_result = ai_orchestrator.get_todays_headlines()
        
        if not ai_result.get('success'):
            # Fallback to traditional method if AI fails
            raw = await newsapi.get_todays_headlines(language=language)
            normalized = normalize.normalize_articles(raw)
            tagged = classify.classify_local_foreign(normalized)
            summarized = summarize.summarize(tagged)
            enriched = ner_geo.add_locations(summarized)
            
            # Generate enhanced metadata and analysis
            enhanced_articles = present.enhance_articles_metadata(enriched)
            stacks = present.stack_by_country(enhanced_articles)
            
            # If traditional headlines produced no stacks, build stacks from search queries
            if not stacks:
                default_queries = [
                    "international",
                    "world",
                    "global",
                    "technology",
                ]
                collected_articles = []
                for q in default_queries:
                    try:
                        sr = await newsapi.search_today(q=q, language=language)
                        sr_norm = normalize.normalize_articles(sr)
                        sr_tagged = classify.classify_local_foreign(sr_norm)
                        sr_sum = summarize.summarize(sr_tagged)
                        sr_enriched = ner_geo.add_locations(sr_sum)
                        collected_articles.extend(sr_enriched)
                    except Exception:
                        continue
                if collected_articles:
                    enhanced_articles = present.enhance_articles_metadata(collected_articles)
                    stacks = present.stack_by_country(enhanced_articles)
            
            # Build traditional response
            resp = SearchResponse(
                stacks=stacks, 
                origin_country=None, 
                map=None, 
                trending=None
            )
            return resp
        
        # Process AI-discovered topics into the expected format
        enhanced_articles = []
        stacks_dict = {}

        # If Gemini topics have no articles yet, fetch via NewsAPI using keywords
        ai_topics = ai_result.get('topics', [])
        for topic in ai_topics:
            if not topic.get('articles'):
                topic_articles = []
                keywords = topic.get('search_keywords', []) or [topic.get('title', '')]
                regions = topic.get('regions', [])
                region = regions[0] if regions else 'Global'
                try:
                    # Use first keyword to fetch a small set of fresh articles
                    kw = (keywords[0] if keywords else topic.get('title', 'world')) or 'world'
                    raw = await newsapi.search_today(q=kw, language=language)
                    for art in (raw[:6] if raw else []):
                        source_name = art.get('source', {}).get('name') or art.get('source_name', '')
                        topic_articles.append({
                            'title': art.get('title', ''),
                            'description': art.get('description', ''),
                            'content': art.get('content', ''),
                            'url': art.get('url', ''),
                            'source_name': source_name,
                            'publish_date': art.get('publishedAt', ''),
                            'image_url': art.get('urlToImage', ''),
                            'author': art.get('author', ''),
                            'language': language,
                            'word_count': 0,
                            'region': region,
                            'verification_analysis': {}
                        })
                except Exception:
                    # Keep topic articles empty if fetching fails
                    topic_articles = []
                topic['articles'] = topic_articles

        for topic in ai_topics:
            for article in topic.get('articles', []):
                # Convert AI article format to expected format
                enhanced_article = {
                    'title': article.get('title', ''),
                    'description': article.get('description', ''),
                    'content': article.get('content', ''),
                    'url': article.get('url', ''),
                    'source': article.get('source_name', ''),
                    'publishedAt': article.get('publish_date', ''),
                    'urlToImage': article.get('image_url', ''),
                    'author': article.get('author', ''),
                    'language': article.get('language', language),
                    'word_count': article.get('word_count', 0),
                    'ai_topic': topic.get('title', ''),
                    'ai_category': topic.get('category', ''),
                    'ai_region': article.get('region', ''),
                    'ai_verification': article.get('verification_analysis', {}),
                    'ai_powered': True
                }
                enhanced_articles.append(enhanced_article)
                
                # Group by region for stacks
                region = article.get('region', 'Unknown')
                if region not in stacks_dict:
                    stacks_dict[region] = []
                stacks_dict[region].append(enhanced_article)
        
        # Convert stacks dictionary to list format expected by SearchResponse
        stacks = []
        for region, articles in stacks_dict.items():
            stack_data = {
                "origin_country": region,
                "local": articles,  # For AI results, treat all as local to the region
                "foreign_by_country": {},
                "regional": [],
                "neutral": [],
                "statistics": {
                    "total_articles": len(articles),
                    "local_count": len(articles),
                    "foreign_count": 0,
                    "regional_count": 0,
                    "neutral_count": 0
                }
            }
            stacks.append(stack_data)
        
        # Generate AI-powered perspective summary
        perspective_summary = {
            'total_topics': ai_result.get('total_topics', 0),
            'total_articles': ai_result.get('total_articles', 0),
            'ai_analysis': ai_result.get('analysis', {}),
            'regions_covered': list(stacks_dict.keys()),
            'ai_powered': True,
            'generated_at': ai_result.get('generated_at', '')
        }
        
        # Build AI-enhanced response
        resp = SearchResponse(
            stacks=stacks, 
            origin_country=None, 
            map=None, 
            trending=None
        )
        return resp
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching headlines: {str(e)}")

@app.get("/api/search", response_model=SearchResponse)
async def search(q: str = Query(..., min_length=2), language: Optional[str] = "en"):
    try:
        # Fetch and process articles
        raw = await newsapi.search_today(q=q, language=language)
        normalized = normalize.normalize_articles(raw)
        tagged = classify.classify_local_foreign(normalized)
        summarized = summarize.summarize(tagged)
        enriched = ner_geo.add_locations(summarized)  # no-op placeholder
        
        # Generate enhanced metadata and analysis
        enhanced_articles = present.enhance_articles_metadata(enriched)
        stacks = present.stack_by_country(enhanced_articles)
        perspective_summary = present.generate_perspective_summary(enhanced_articles)
        
        # Build enhanced response
        resp = SearchResponse(
            stacks=stacks, 
            origin_country=None, 
            map=None, 
            trending=None
        )
        
        # Add enhanced metadata to response
        response_data = resp.model_dump()
        response_data.update({
            "perspective_summary": perspective_summary,
            "articles": enhanced_articles,  # Include articles in regular search
            "enhanced_articles": enhanced_articles,
            "query_metadata": {
                "query": q,
                "language": language,
                "total_articles": len(enhanced_articles),
                "processing_timestamp": None  # Could add timestamp if needed
            }
        })
        
        return JSONResponse(response_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/test/gemini")
async def test_gemini_only(text: str = Form(...)):
    """
    Test endpoint for Gemini-only functionality (bypassing OpenAI)
    """
    try:
        from backend.services.gemini_verification_service import gemini_verification
        from datetime import datetime
        
        # Test Gemini verification service
        result = gemini_verification.verify_article_authenticity(
            article_content=text,
            source_url="https://test.example.com"
        )
        
        return {
            "status": "success",
            "service": "gemini_only",
            "result": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Gemini test failed: {str(e)}",
                "service": "gemini_only"
            }
        )

@app.get("/api/search/ai")
async def search_ai(q: str = Query(..., min_length=2), language: Optional[str] = "en"):
    """AI-powered search using ChatGPT discovery and Gemini verification"""
    try:
        # Use AI orchestrator for intelligent search
        ai_result = ai_orchestrator.search_news_by_topic(q)
        
        if not ai_result.get('success') or ai_result.get('total_articles', 0) == 0:
            # Fallback to traditional search if AI fails or returns no results
            return await search(q=q, language=language)
        
        # Process AI search results into the expected format
        enhanced_articles = []
        stacks_dict = {}
        
        for article in ai_result.get('articles', []):
            # Convert AI article format to expected format
            enhanced_article = {
                'title': article.get('title', ''),
                'description': article.get('description', ''),
                'content': article.get('content', ''),
                'url': article.get('url', ''),
                'source': article.get('source_name', ''),
                'publishedAt': article.get('publish_date', ''),
                'urlToImage': article.get('image_url', ''),
                'author': article.get('author', ''),
                'language': article.get('language', language),
                'word_count': article.get('word_count', 0),
                'ai_perspective': article.get('perspective', {}),
                'ai_source_info': article.get('source_info', {}),
                'ai_powered': True
            }
            enhanced_articles.append(enhanced_article)
            
            # Group by perspective region for stacks
            perspective = article.get('perspective', {})
            region = perspective.get('region', 'Unknown')
            if region not in stacks_dict:
                stacks_dict[region] = []
            stacks_dict[region].append(enhanced_article)
        
        # Convert stacks dictionary to list format expected by SearchResponse
        stacks = []
        for region, articles in stacks_dict.items():
            stack_data = {
                "origin_country": region,
                "local": articles,  # For AI results, treat all as local to the region
                "foreign_by_country": {},
                "regional": [],
                "neutral": [],
                "statistics": {
                    "total_articles": len(articles),
                    "local_count": len(articles),
                    "foreign_count": 0,
                    "regional_count": 0,
                    "neutral_count": 0
                }
            }
            stacks.append(stack_data)
        
        # Generate AI-powered perspective summary
        perspective_summary = {
            'query': ai_result.get('query', q),
            'keywords': ai_result.get('keywords', []),
            'perspectives': ai_result.get('perspectives', []),
            'total_articles': ai_result.get('total_articles', 0),
            'verification_analysis': ai_result.get('verification_analysis', {}),
            'fact_check': ai_result.get('fact_check', {}),
            'regions_covered': list(stacks_dict.keys()),
            'ai_powered': True,
            'searched_at': ai_result.get('searched_at', '')
        }
        
        # Build AI-enhanced response
        resp = SearchResponse(
            stacks=stacks, 
            origin_country=None, 
            map=None, 
            trending=None
        )
        
        # Add AI metadata to response
        response_data = resp.model_dump()
        response_data.update({
            "perspective_summary": perspective_summary,
            "articles": enhanced_articles,
            "enhanced_articles": enhanced_articles,
            "ai_metadata": {
                "query": q,
                "language": language,
                "total_articles": len(enhanced_articles),
                "ai_powered": True,
                "service_used": "ai_orchestrator",
                "processing_timestamp": ai_result.get('searched_at', '')
            }
        })
        
        return JSONResponse(response_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI search failed: {str(e)}")

@app.post("/api/analyze/credibility")
async def analyze_credibility(url: str = Form(...)):
    """Analyze the credibility of a specific article using AI"""
    try:
        analysis = ai_orchestrator.analyze_article_credibility(url)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Credibility analysis failed: {str(e)}")

@app.get("/api/lambda/test")
async def test_lambda_connection():
    """Test the Lambda service connection via GraphQL"""
    try:
        success = await lambda_service.test_connection()
        return {"status": "success" if success else "failed", "service": "lambda_graphql"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lambda test failed: {str(e)}")

@app.post("/api/lambda/summary")
async def generate_lambda_summary(title: str = Form(...), description: str = Form(...)):
    """Generate article summary using Lambda service"""
    try:
        summary = await lambda_service.generate_summary(title, description)
        return {"summary": summary, "service": "lambda_graphql"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lambda summary failed: {str(e)}")

@app.post("/api/lambda/predictions")
async def generate_lambda_predictions(article: dict):
    """Generate predictions using Lambda service"""
    try:
        predictions = await lambda_service.generate_predictions(article)
        return {"predictions": predictions, "service": "lambda_graphql"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lambda predictions failed: {str(e)}")

@app.post("/api/bedrock/predictions")
async def generate_bedrock_predictions(article: dict):
    """Generate predictions using Bedrock service"""
    try:
        # Proxy to Lambda GraphQL service to ensure working path
        predictions = await lambda_service.generate_predictions(article)
        return {"predictions": predictions, "service": "lambda_graphql"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bedrock predictions proxy failed: {str(e)}")

@app.post("/api/bedrock/summary")
async def generate_bedrock_summary(article: dict):
    """Generate article summary using Bedrock service"""
    try:
        # Proxy to Lambda GraphQL service to ensure working path
        title = article.get("title", "")
        description = article.get("description", "")
        summary = await lambda_service.generate_summary(title, description)
        return {"summary": summary, "service": "lambda_graphql"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bedrock summary proxy failed: {str(e)}")

@app.get("/api/search/enhanced", response_model=SearchResponse)
async def search_enhanced(q: str = Query(..., min_length=2), language: Optional[str] = "en", use_lambda: bool = False):
    """Enhanced search with optional Lambda service integration"""
    try:
        # Fetch and process articles
        raw = await newsapi.search_today(q=q, language=language)
        normalized = normalize.normalize_articles(raw)
        tagged = classify.classify_local_foreign(normalized)
        summarized = summarize.summarize(tagged)
        enriched = ner_geo.add_locations(summarized)
        
        # Choose service based on parameter
        if use_lambda:
            # Use Lambda service for AI processing
            enhanced_articles = await lambda_service.batch_process_articles(enriched)
            service_used = "lambda_graphql"
        else:
            # Use existing Bedrock service
            enhanced_articles = await bedrock_service.batch_process_articles(enriched)
            service_used = "bedrock_direct"
        
        # Generate enhanced metadata and analysis
        enhanced_articles = present.enhance_articles_metadata(enhanced_articles)
        stacks = present.stack_by_country(enhanced_articles)
        perspective_summary = present.generate_perspective_summary(enhanced_articles)
        
        # Build enhanced response
        resp = SearchResponse(
            stacks=stacks, 
            origin_country=None, 
            map=None, 
            trending=None
        )
        
        # Debug logging before response
        if enhanced_articles:
            first_article = enhanced_articles[0]
            print(f"DEBUG: First article title: {first_article.get('title', 'No title')}")
            print(f"DEBUG: Has detected_locations: {'detected_locations' in first_article}")
            print(f"DEBUG: Has geographic_analysis: {'geographic_analysis' in first_article}")
            if 'detected_locations' in first_article:
                print(f"DEBUG: Detected locations: {first_article['detected_locations']}")
        
        # Add enhanced metadata to response
        response_data = resp.model_dump()
        response_data.update({
            "perspective_summary": perspective_summary,
            "enhanced_articles": enhanced_articles,
            "query_metadata": {
                "query": q,
                "language": language,
                "total_articles": len(enhanced_articles),
                "service_used": service_used,
                "processing_timestamp": None
            }
        })
        
        return JSONResponse(response_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/config/maps-key")
async def get_maps_key():
    """Return Google Maps API key from environment for frontend use."""
    key = os.getenv("GOOGLE_GEOCODING_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
    if not key:
        return JSONResponse({"success": False, "message": "Maps key not configured"}, status_code=404)
    return {"success": True, "apiKey": key}
