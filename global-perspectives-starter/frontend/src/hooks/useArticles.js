import { useState, useEffect } from 'react';
import { getTodaysHeadlines } from '../utils/api';

/**
 * Centralized hook for fetching and managing articles
 * This ensures both Home and Map components use the exact same data
 */
export function useArticles() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stacks, setStacks] = useState(null);

  const loadArticles = async () => {
    console.log('🔄 useArticles: Starting to load headlines...');
    setLoading(true);
    setError(null);
    
    try {
      // Fetch articles using search to bypass AI discovery
      const results = await getTodaysHeadlines('en');
      console.log('📡 useArticles: Raw API response:', results);
      
      // Store the complete stacks structure for Home component
      setStacks(results?.stacks || []);
      console.log('🏠 useArticles: Stacks for Home component:', results?.stacks);
      
      // Extract all articles for Map component
      const allArticles = [];
      console.log('🔍 useArticles: Starting article extraction...');
      console.log('🔍 useArticles: Results stacks exist?', !!results?.stacks);
      console.log('🔍 useArticles: Number of stacks:', results?.stacks?.length || 0);
      
      if (results?.stacks) {
        results.stacks.forEach((stack, stackIndex) => {
          console.log(`📚 Processing stack ${stackIndex}:`, stack);
          
          if (stack.local && Array.isArray(stack.local)) {
            console.log(`  📍 Adding ${stack.local.length} local articles`);
            allArticles.push(...stack.local);
          }
          if (stack.foreign_by_country && typeof stack.foreign_by_country === 'object') {
            Object.entries(stack.foreign_by_country).forEach(([country, countryArticles]) => {
              if (Array.isArray(countryArticles)) {
                console.log(`  🌍 Adding ${countryArticles.length} articles from ${country}`);
                allArticles.push(...countryArticles);
              }
            });
          }
          if (stack.regional && Array.isArray(stack.regional)) {
            console.log(`  🌎 Adding ${stack.regional.length} regional articles`);
            allArticles.push(...stack.regional);
          }
          if (stack.neutral && Array.isArray(stack.neutral)) {
            console.log(`  ⚖️ Adding ${stack.neutral.length} neutral articles`);
            allArticles.push(...stack.neutral);
          }
          
          console.log(`📊 Stack ${stackIndex} processed. Current total articles: ${allArticles.length}`);
        });
      }
      
      console.log('🗺️ useArticles: Total articles for Map:', allArticles.length);
      console.log('📋 useArticles: First few article titles for Map:', allArticles.slice(0, 3).map(a => a?.title));
      console.log('🔧 useArticles: About to call setArticles with:', allArticles.length, 'articles');
      
      setArticles(allArticles);
      console.log('✅ useArticles: setArticles called successfully');
    } catch (err) {
      console.error('❌ useArticles: Error fetching headlines:', err);
      setError('Failed to fetch news articles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load articles on mount
  useEffect(() => {
    loadArticles();
  }, []);

  return {
    articles,        // Flat array of all articles (for Map)
    stacks,         // Structured stacks (for Home)
    loading,
    error,
    refetch: loadArticles
  };
}