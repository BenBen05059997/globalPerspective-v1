# Hybrid News Architecture: Real Sources + AI Analysis

## Current Problem
- Gemini generates fictional content based on training data
- No real-time news access
- Outdated/synthetic topics

## Proposed Solution: Multi-Source News Aggregation + AI Enhancement

### Architecture Overview
```
News Sources (APIs) → Aggregator Lambda → Gemini Analysis → Final Topics
```

### Data Flow
1. **Real News Feed**: Pull headlines from multiple verified sources
2. **Filter & Deduplicate**: Remove duplicates, score for relevance
3. **AI Enhancement**: Gemini analyzes real headlines for geographic/temporal insights
4. **Final Topics**: Real news + AI-generated metadata

### Implementation Plan

#### Phase 1: Single Source Integration (Immediate)
```javascript
// New Lambda: newsFeedAggregator
async function fetchMultipleHeadlines() {
  const sources = [
    {
      name: 'NewsAPI',
      url: 'https://newsapi.org/v2/top-headlines',
      params: { country: 'us', category: 'general' }
    }
  ];
  
  const allHeadlines = [];
  for (const source of sources) {
    try {
      const headlines = await fetchFromSource(source);
      allHeadlines.push(...headlines);
    } catch (error) {
      console.warn(`Failed to fetch from ${source.name}:`, error);
    }
  }
  
  return deduplicateAndScore(allHeadlines);
}
```

#### Phase 2: Multi-Source Expansion
```javascript
const sources = [
  {
    name: 'NewsAPI',
    url: 'https://newsapi.org/v2/top-headlines',
    params: { country: 'us', category: 'general' }
  },
  {
    name: 'Reuters',
    url: 'https://reuters.com/feed/world',
    // Custom parser needed
  },
  {
    name: 'BBC',
    url: 'https://newsapi.org/v2/top-headlines',
    params: { sources: 'bbc-news' }
  }
];
```

#### Phase 3: Enhanced Analysis
```javascript
// Modified Gemini prompt
const analysisPrompt = [
  `Given these REAL news headlines from ${currentDateString}:`,
  headlines.slice(0, 50).map(h => `- ${h.title} (${h.source.name})`).join('\n'),
  '',
  'Generate 10 topics based on ACTUAL current events:',
  '1. Each topic MUST be based on real headlines above',
  '2. Extract geographic information from actual articles',
  '3. Identify trending patterns across multiple sources',
  '4. Provide specific locations that actually appear in the news',
  '',
  'Return JSON with verified current topics only.'
];
```

### Environment Variables Needed
```bash
NEWSAPI_KEY=newsapi_key_here
REUTERS_API_KEY=reuters_key_here  
BBC_NEWS_API_KEY=bbc_key_here
GAURDIAN_API_KEY=guardian_key_here
```

### Benefits of This Approach
- ✅ **Real Current News**: All topics based on actual headlines
- ✅ **Geographic Accuracy**: Real locations from real articles  
- ✅ **Source Diversity**: Multiple perspectives reduce bias
- ✅ **Reduced Hallucination**: AI analyzes rather than creates
- ✅ **Verifiability**: Every topic traceable to source articles
- ✅ **Fresh Content**: Updated hourly with real breaking news

### Implementation Timeline
- **Week 1**: NewsAPI integration, basic filtering
- **Week 2**: Multi-source expansion, deduplication
- **Week 3**: Enhanced Gemini analysis on real data
- **Week 4**: Full integration, testing, and optimization

### Cost Analysis
- **NewsAPI**: $49/month developer plan
- **Gemini**: $0.0025/1K characters (reduced usage)
- **Total**: ~$50/month (vs current ~$200/month for pure AI hallucinations)

### Risk Mitigation
- **API Limits**: Implement caching and rate limiting
- **Source Failure**: Fallback between multiple providers
- **Quality Control**: Manual review of top 10 topics daily
- **Bias Detection**: Track source distribution and adjust weights

### Success Metrics
- 📈 User engagement with real vs. generated topics
- 📊 Geographic accuracy improvements  
- ⏱️ Freshness score (time from news break to appearance)
- 🎯 User satisfaction ratings on topic relevance
