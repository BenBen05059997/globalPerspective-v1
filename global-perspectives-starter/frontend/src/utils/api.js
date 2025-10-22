// API base URL - adjust based on environment
const API_BASE_URL = 'http://localhost:8000';

/**
 * Generic API request function
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  console.log('API Request:', url);
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    });

    clearTimeout(timeoutId);
    console.log('API Response status:', response.status);

    if (!response.ok) {
      console.error('API Error - Status:', response.status);
      let errorMessage = `HTTP error! status: ${response.status}`;
      
      // Try to get error details from response
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch {
        // If we can't parse the error response, use the status
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('API Response data:', data);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('API Request failed:', error);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please try again');
    }
    
    throw error;
  }
}

/**
 * Check API health
 */
export async function checkHealth() {
  return apiRequest('/healthz');
}

/**
 * Get today's top headlines
 * @param {string} language - Language code (default: 'en')
 * @returns {Promise<Object>} Headlines with stacks
 */
export async function getTodaysHeadlines(language = 'en') {
  const params = new URLSearchParams({
    language: language,
  });
  
  return apiRequest(`/api/headlines?${params}`);
}

/**
 * Search for news articles
 * @param {string} query - Search query
 * @param {string} language - Language code (default: 'en')
 * @returns {Promise<Object>} Search results with stacks
 */
export async function searchNews(query, language = 'en') {
  const params = new URLSearchParams({
    q: query,
    language: language,
  });
  
  return apiRequest(`/api/search?${params}`);
}

/**
 * AI-powered search for news articles using ChatGPT discovery and Gemini verification
 * @param {string} query - Search query
 * @param {string} language - Language code (default: 'en')
 * @returns {Promise<Object>} AI-enhanced search results with perspectives and verification
 */
export async function searchNewsAI(query, language = 'en') {
  const params = new URLSearchParams({
    q: query,
    language: language,
  });
  
  return apiRequest(`/api/search/ai?${params}`);
}

/**
 * Analyze the credibility of a specific article using AI
 * @param {string} url - Article URL to analyze
 * @returns {Promise<Object>} Credibility analysis results
 */
export async function analyzeCredibility(url) {
  const formData = new FormData();
  formData.append('url', url);
  
  return apiRequest('/api/analyze/credibility', {
    method: 'POST',
    body: formData,
    headers: {
      // Don't set Content-Type for FormData, let browser set it
    }
  });
}

/**
 * Format article data for display
 */
export function formatArticle(article) {
  return {
    ...article,
    publishedAt: new Date(article.published_at).toLocaleString(),
    summaryText: article.summary_phrases?.join(' • ') || 'No summary available',
  };
}

/**
 * Group articles by classification
 */
export function groupArticlesByClassification(articles) {
  return articles.reduce((groups, article) => {
    const classification = article.classification || 'unknown';
    if (!groups[classification]) {
      groups[classification] = [];
    }
    groups[classification].push(formatArticle(article));
    return groups;
  }, {});
}

// Fetch trending topics discovered by Google Gemini (no articles)
export async function getGeminiTopics() {
  return apiRequest('/api/topics/gemini');
}