# AI Services Implementation Plan

## System Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ 
│   ChatGPT-4     │    │  Google Gemini  │    │   Existing      │ 
│  News Discovery │───▶│  Verification   │───▶│  AWS Bedrock    │ 
│                 │    │  & Analysis     │    │  Processing     │ 
└─────────────────┘    └─────────────────┘    └─────────────────┘ 
│                       │                       │ 
▼                       ▼                       ▼ 
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ 
│ Source URLs     │    │ Content         │    │ Final Articles  │ 
│ & Topics        │    │ Extraction      │    │ with Analysis   │ 
└─────────────────┘    └─────────────────┘    └─────────────────┘ 
```

## Core Concept

Replace traditional news APIs (NewsAPI, etc.) with AI-powered news discovery using:
- **ChatGPT-4** for intelligent topic discovery and local source identification
- **Google Gemini** for content verification and quality analysis
- **Content Extraction Service** for intelligent web scraping
- **AI News Orchestrator** to coordinate all services
- **Existing AWS Bedrock** for final processing and analysis

## ChatGPT Discovery Prompt Strategy

### Primary Discovery Prompt:
```
"What are the top 5 international conflicts or political tensions happening TODAY? 

For each, provide: 
1. Brief description 
2. Countries/regions involved 
3. 3-5 reliable LOCAL news sources from those regions 
4. Suggested search keywords"
```

### Additional Discovery Prompts:
- Economic developments and market impacts
- Environmental and climate events
- Social movements and cultural shifts
- Technology and innovation breakthroughs
- Health and pandemic updates

## Service Architecture

```
backend/services/
├── chatgpt_discovery_service.py    # Topic & source discovery
├── gemini_verification_service.py  # Content verification & analysis
├── content_extraction_service.py   # Intelligent web scraping
├── ai_news_orchestrator.py        # Coordinates all AI services
└── bedrock_service.py             # Existing - final processing
```

## Implementation Strategy

### 1. AI Discovery Pipeline
**Flow:** ChatGPT finds topics → Gemini verifies sources → Web scraping extracts content → Bedrock processes

### 2. Four New Services
Modular approach with dedicated services for each function:

#### A. ChatGPT Discovery Service (`chatgpt_discovery_service.py`)
**Purpose:** Topic discovery and local source identification
**Functions:**
- `discover_trending_topics()` - Find current global topics
- `find_local_sources(topic, region)` - Identify authentic local news sources
- `generate_search_keywords(topic)` - Create diverse search terms
- `get_regional_perspectives(topic)` - Find sources from different regions

**Output Format:**
```python
{
    "topic": "Ukraine Conflict Update",
    "description": "Latest developments in ongoing conflict",
    "regions": ["Ukraine", "Russia", "Poland", "EU"],
    "local_sources": [
        {"name": "Kyiv Independent", "url": "kyivindependent.com", "region": "Ukraine"},
        {"name": "Meduza", "url": "meduza.io", "region": "Russia"},
        # ...
    ],
    "search_keywords": ["Ukraine war", "Zelenskyy", "Putin", "NATO response"]
}
```

#### B. Gemini Verification Service (`gemini_verification_service.py`)
**Purpose:** Content verification and quality analysis
**Functions:**
- `verify_source_credibility(source_url)` - Check source reliability
- `analyze_content_quality(article_text)` - Score content quality
- `detect_bias(article_text)` - Identify potential bias
- `cross_reference_facts(claims)` - Verify factual accuracy

**Output Format:**
```python
{
    "credibility_score": 0.85,
    "quality_score": 0.92,
    "bias_analysis": {
        "bias_level": "low",
        "political_lean": "neutral",
        "confidence": 0.78
    },
    "fact_check_results": {
        "verified_claims": 5,
        "disputed_claims": 1,
        "accuracy_score": 0.83
    }
}
```

#### C. Content Extraction Service (`content_extraction_service.py`)
**Purpose:** Intelligent web scraping with respect for robots.txt
**Functions:**
- `extract_article_content(url)` - Clean article extraction
- `extract_metadata(url)` - Get title, author, date, etc.
- `batch_extract(urls)` - Process multiple URLs efficiently
- `respect_rate_limits(domain)` - Honor website policies

**Features:**
- Respects robots.txt and rate limits
- Handles different website structures
- Extracts clean text without ads/navigation
- Fallback mechanisms for difficult sites

#### D. AI News Orchestrator (`ai_news_orchestrator.py`)
**Purpose:** Coordinate the entire AI pipeline
**Functions:**
- `get_todays_headlines()` - Main entry point for daily news
- `search_topic(query)` - Search for specific topics
- `process_ai_pipeline(topic)` - Run full AI discovery → verification → extraction
- `fallback_to_traditional_apis()` - Backup when AI services fail

**Pipeline Flow:**
1. ChatGPT discovers topics and sources
2. Gemini verifies source credibility
3. Content extraction scrapes verified sources
4. Gemini analyzes extracted content quality
5. Return processed articles to existing Bedrock pipeline

### 3. Existing Integration Points
- **agent/orchestrator.py** - Update to use AI services instead of NewsAPI
- **backend/api.py** - Modify endpoints to call AI orchestrator
- **Existing Processing Pipeline** - Keep normalization, classification, summarization unchanged

### 4. Fallback Systems
Multiple backup options if AI services fail:
- Traditional NewsAPI as primary fallback
- NewsData.io as secondary fallback
- Cached results from previous successful AI runs
- Manual source lists for critical topics

## Key Features

### ✅ ChatGPT Integration
- Discovers trending topics automatically
- Identifies local news sources from affected regions
- Generates diverse search keywords
- Provides regional perspective mapping

### ✅ Google Gemini Integration  
- Verifies source credibility and reliability
- Analyzes content quality and bias
- Cross-references factual claims
- Provides content scoring metrics

### ✅ No Enhanced Perspective Analysis
- Focuses purely on finding reliable sources
- Maintains existing AWS Bedrock analysis pipeline
- Preserves current summarization and prediction services

### ✅ Local Source Priority
- Emphasizes authentic local voices over international media
- Discovers region-specific news outlets
- Balances multiple perspectives from affected areas
- Reduces Western media bias in global coverage

## Environment Configuration

```bash
# AI Services Configuration
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here
AI_DISCOVERY_ENABLED=true
MAX_SOURCES_PER_TOPIC=5
SCRAPING_DELAY_SECONDS=2
```

## Implementation Phases

### Phase 1: Core Services Development
1. Create ChatGPT Discovery Service
2. Create Gemini Verification Service  
3. Create Content Extraction Service
4. Create AI News Orchestrator

### Phase 2: Integration
1. Update agent/orchestrator.py
2. Modify backend/api.py endpoints
3. Add fallback mechanisms
4. Test with existing frontend

### Phase 3: Testing & Optimization
1. Test with real API keys
2. Optimize rate limits and performance
3. Add error handling and logging
4. Performance monitoring and metrics

## Success Metrics

- **Source Diversity**: Increase in local/regional news sources vs international media
- **Content Quality**: Gemini verification scores above 0.8
- **Topic Coverage**: AI discovers 20+ relevant topics daily
- **System Reliability**: 95% uptime with fallback systems
- **Response Time**: Complete pipeline under 30 seconds per topic

## Risk Mitigation

- **API Rate Limits**: Implement intelligent caching and request batching
- **Content Extraction Failures**: Multiple extraction strategies per site
- **AI Service Outages**: Robust fallback to traditional APIs
- **Source Reliability**: Gemini verification prevents low-quality sources
- **Legal Compliance**: Respect robots.txt and fair use policies

---

**Ready for Implementation**: This plan provides a clear roadmap for replacing traditional news APIs with AI-powered discovery while maintaining system reliability and performance.