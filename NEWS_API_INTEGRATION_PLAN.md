# News API Integration Plan

## Problem
Gemini models lack real-time news access and generate fictional/outdated content based on training data cutoff dates.

## Solution: NewsAPI.org Integration

### Architecture
1. **Lambda Function**: `newsInvokeGemini` will first fetch real headlines from NewsAPI
2. **AI Analysis**: Gemini will analyze real headlines to generate topics and insights
3. **Hybrid Approach**: Combine real news data with AI-generated analysis

### Implementation Steps

#### Step 1: Update Lambda Function
```javascript
// Add to newsInvokeGemini/src/index.js
async function fetchRealNewsHeadlines() {
  const apiKey = process.env.NEWSAPI_KEY;
  const url = `https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.articles || [];
  } catch (error) {
    console.error('NewsAPI fetch error:', error);
    return [];
  }
}
```

#### Step 2: Modified Prompt
```javascript
const realHeadlines = await fetchRealNewsHeadlines();
const headlinesText = realHeadlines.map(h => h.title).join('\n');

const prompt = [
  `Analyze these REAL current news headlines from ${currentDateString}:`,
  headlinesText,
  '',
  'Based on these actual headlines, generate 10 trending topics with geographic analysis...',
  // ... rest of prompt
];
```

#### Step 3: Environment Variables
Add to Lambda environment:
- `NEWSAPI_KEY` (from newsapi.org)

#### Step 4: Benefits
- ✅ Real, current news content
- ✅ Geographic relevance based on actual stories  
- ✅ Reduced hallucinations
- ✅ Verifiable sources
- ✅ Fresh content every hour

### Alternative News Sources
1. **BBC News API**: British perspective, global coverage
2. **Reuters API**: Professional news agency sourcing
3. **Associated Press**: US-focused but international coverage
4. **The Guardian API**: Progressive perspective
5. **NewsData.io**: Alternative with good free tier

### Cost Analysis
- **NewsAPI.org**: $499/month for everything, $49/month developer plan
- **Alternative**: Multiple free tiers available across providers
- **Current**: Only Gemini API costs

### Migration Strategy
1. Add NewsAPI integration alongside existing Gemini-only approach
2. A/B test both approaches
3. Gradually phase out pure-AI generation
4. Monitor for quality improvements

### Potential Issues to Monitor
- API rate limits and quotas
- Source bias in news selection
- Geographic coverage gaps
- Content quality variations
