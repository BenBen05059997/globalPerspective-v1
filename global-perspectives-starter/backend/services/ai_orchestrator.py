"""
AI Orchestrator Service

This service coordinates all AI services to provide intelligent news discovery,
content extraction, and verification in a unified interface.
"""

import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor

from .chatgpt_discovery_service import chatgpt_discovery
from .gemini_verification_service import gemini_verification
from .content_extraction_service import content_extractor
from backend.tools import newsapi

logger = logging.getLogger(__name__)

class AIOrchestrator:
    def __init__(self):
        # Enable AI discovery and use Gemini-only for topic discovery
        self.ai_discovery_enabled = True
        self.max_sources_per_topic = int(os.getenv('MAX_SOURCES_PER_TOPIC', 5))
        self.executor = ThreadPoolExecutor(max_workers=4)
        
    def get_todays_headlines(self) -> Dict[str, Any]:
        """
        Get today's headlines using AI-powered discovery and verification.
        
        Returns:
            Dictionary with discovered topics, articles, and analysis
        """
        try:
            if not self.ai_discovery_enabled:
                return self._get_fallback_headlines()
            
            logger.info("Starting Gemini-powered news discovery...")
            
            # Step 1: Discover trending topics with Gemini
            topics = gemini_verification.discover_trending_topics()
            
            if not topics:
                logger.warning("No topics discovered, using fallback")
                return self._get_fallback_headlines()
            
            # Step 2: Package topics; articles will be fetched downstream in API
            processed_topics = []
            for topic in topics[:5]:
                processed_topics.append({
                    **topic,
                    'articles': [],
                    'article_count': 0,
                    'verification_analysis': {},
                    'processed_at': datetime.now().isoformat()
                })
            
            # Step 3: Generate overall analysis
            overall_analysis = self._generate_overall_analysis(processed_topics)
            
            result = {
                'success': True,
                'topics': processed_topics,
                'total_topics': len(processed_topics),
                'total_articles': sum(len(topic.get('articles', [])) for topic in processed_topics),
                'analysis': overall_analysis,
                'generated_at': datetime.now().isoformat(),
                'ai_powered': True
            }
            
            logger.info(f"Successfully generated {len(processed_topics)} topics with AI analysis")
            return result
            
        except Exception as e:
            logger.error(f"Error in AI orchestrator: {str(e)}")
            return self._get_fallback_headlines()
    
    def search_news_by_topic(self, query: str) -> Dict[str, Any]:
        """
        Search for news using AI-powered topic analysis and source discovery.
        
        Args:
            query: Search query or topic
            
        Returns:
            Dictionary with search results and analysis
        """
        try:
            if not self.ai_discovery_enabled:
                return self._get_fallback_search(query)
            
            logger.info(f"Starting AI-powered search for: {query}")
            
            # Step 1: Generate search keywords
            keywords = chatgpt_discovery.generate_search_keywords(query)
            
            # Step 2: Get regional perspectives
            perspectives = chatgpt_discovery.get_regional_perspectives(query)
            
            # Step 3: Find local sources for each perspective
            all_articles = []
            
            for perspective in perspectives[:3]:  # Limit to 3 perspectives
                try:
                    region = perspective.get('region', 'Unknown')
                    sources = chatgpt_discovery.find_local_sources(query, region)
                    
                    # Extract articles from sources
                    for source in sources[:2]:  # Limit to 2 sources per region
                        try:
                            source_url = f"https://{source.get('url', '')}"
                            articles = content_extractor.search_articles_by_keywords(
                                source_url, keywords[:3]
                            )
                            
                            # Extract content for top articles
                            for article in articles[:2]:  # Limit to 2 articles per source
                                content = content_extractor.extract_article_content(article['url'])
                                if content.get('extraction_success'):
                                    content['perspective'] = perspective
                                    content['source_info'] = source
                                    all_articles.append(content)
                                    
                        except Exception as e:
                            logger.warning(f"Error extracting from source {source.get('name', 'Unknown')}: {str(e)}")
                            continue
                            
                except Exception as e:
                    logger.warning(f"Error processing perspective {perspective.get('region', 'Unknown')}: {str(e)}")
                    continue
            
            # Step 4: Verify and analyze articles
            if all_articles:
                verification_analysis = gemini_verification.detect_misinformation_patterns(all_articles)
                fact_check = gemini_verification.generate_fact_check_summary(query, all_articles)
            else:
                verification_analysis = {}
                fact_check = {}
            
            result = {
                'success': True,
                'query': query,
                'keywords': keywords,
                'perspectives': perspectives,
                'articles': all_articles,
                'total_articles': len(all_articles),
                'verification_analysis': verification_analysis,
                'fact_check': fact_check,
                'searched_at': datetime.now().isoformat(),
                'ai_powered': True
            }
            
            logger.info(f"AI search completed: {len(all_articles)} articles found")
            return result
            
        except Exception as e:
            logger.error(f"Error in AI search: {str(e)}")
            return self._get_fallback_search(query)
    
    def analyze_article_credibility(self, url: str) -> Dict[str, Any]:
        """
        Analyze the credibility of a specific article.
        
        Args:
            url: URL of the article to analyze
            
        Returns:
            Dictionary with credibility analysis
        """
        try:
            logger.info(f"Analyzing article credibility: {url}")
            
            # Step 1: Extract article content
            article = content_extractor.extract_article_content(url)
            
            if not article.get('extraction_success'):
                return {
                    'success': False,
                    'error': 'Failed to extract article content',
                    'url': url
                }
            
            # Step 2: Verify article authenticity
            authenticity = gemini_verification.verify_article_authenticity(
                article.get('content', ''), url
            )
            
            # Step 3: Analyze source credibility
            source_analysis = gemini_verification.analyze_source_credibility(
                article.get('source_name', ''), url
            )
            
            result = {
                'success': True,
                'url': url,
                'article': article,
                'authenticity_analysis': authenticity,
                'source_analysis': source_analysis,
                'overall_score': self._calculate_overall_credibility_score(authenticity, source_analysis),
                'analyzed_at': datetime.now().isoformat()
            }
            
            logger.info(f"Credibility analysis completed for: {article.get('title', 'Unknown')}")
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing article credibility: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'url': url
            }
    
    def _process_topic(self, topic: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Process a single topic by extracting articles and analyzing them."""
        try:
            topic_title = topic.get('title', 'Unknown Topic')
            logger.info(f"Processing topic: {topic_title}")
            
            # Get local sources for the topic
            regions = topic.get('regions', [])
            all_articles = []
            
            for region in regions[:2]:  # Limit to 2 regions per topic
                try:
                    sources = chatgpt_discovery.find_local_sources(topic_title, region)
                    
                    for source in sources[:2]:  # Limit to 2 sources per region
                        try:
                            # Search for articles on this source
                            source_url = f"https://{source.get('url', '')}"
                            keywords = topic.get('search_keywords', [topic_title])
                            
                            found_articles = content_extractor.search_articles_by_keywords(
                                source_url, keywords[:3]
                            )
                            
                            # Extract content for top articles
                            for article in found_articles[:1]:  # 1 article per source
                                content = content_extractor.extract_article_content(article['url'])
                                if content.get('extraction_success'):
                                    content['region'] = region
                                    content['source_info'] = source
                                    all_articles.append(content)
                                    
                        except Exception as e:
                            logger.warning(f"Error with source {source.get('name', 'Unknown')}: {str(e)}")
                            continue
                            
                except Exception as e:
                    logger.warning(f"Error processing region {region}: {str(e)}")
                    continue
            
            # If no articles found through search, try using provided sources
            if not all_articles and 'local_sources' in topic:
                for source in topic['local_sources'][:3]:
                    try:
                        # Try to extract from the source homepage
                        source_url = f"https://{source.get('url', '')}"
                        content = content_extractor.extract_article_content(source_url)
                        if content.get('extraction_success'):
                            content['source_info'] = source
                            all_articles.append(content)
                    except Exception as e:
                        logger.warning(f"Error extracting from {source.get('name', 'Unknown')}: {str(e)}")
                        continue
            
            # Analyze articles if we have any
            verification_analysis = {}
            if all_articles:
                verification_analysis = gemini_verification.detect_misinformation_patterns(all_articles)
            
            processed_topic = {
                **topic,
                'articles': all_articles,
                'article_count': len(all_articles),
                'verification_analysis': verification_analysis,
                'processed_at': datetime.now().isoformat()
            }
            
            return processed_topic
            
        except Exception as e:
            logger.error(f"Error processing topic: {str(e)}")
            return None
    
    def _generate_overall_analysis(self, topics: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate overall analysis across all topics."""
        try:
            total_articles = sum(len(topic.get('articles', [])) for topic in topics)
            
            # Collect all verification analyses
            all_verifications = []
            for topic in topics:
                verification = topic.get('verification_analysis', {})
                if verification:
                    all_verifications.append(verification)
            
            # Calculate overall reliability
            reliability_scores = []
            for verification in all_verifications:
                if 'consistency_score' in verification:
                    reliability_scores.append(verification['consistency_score'])
            
            avg_reliability = sum(reliability_scores) / len(reliability_scores) if reliability_scores else 50
            
            analysis = {
                'total_topics': len(topics),
                'total_articles': total_articles,
                'average_reliability_score': round(avg_reliability, 1),
                'high_priority_topics': [
                    topic['title'] for topic in topics 
                    if topic.get('urgency') == 'high'
                ],
                'regions_covered': list(set([
                    region for topic in topics 
                    for region in topic.get('regions', [])
                ])),
                'analysis_summary': f"Analyzed {len(topics)} topics with {total_articles} articles from multiple regions",
                'generated_at': datetime.now().isoformat()
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error generating overall analysis: {str(e)}")
            return {
                'error': 'Analysis generation failed',
                'generated_at': datetime.now().isoformat()
            }
    
    def _calculate_overall_credibility_score(self, authenticity: Dict[str, Any], source: Dict[str, Any]) -> int:
        """Calculate overall credibility score from authenticity and source analysis."""
        try:
            auth_score = authenticity.get('authenticity_score', 50)
            source_score = source.get('credibility_score', 50)
            
            # Weighted average (authenticity 60%, source 40%)
            overall_score = int((auth_score * 0.6) + (source_score * 0.4))
            return max(0, min(100, overall_score))
            
        except Exception:
            return 50
    
    def _get_fallback_headlines(self) -> Dict[str, Any]:
        """Fallback headlines when AI services are unavailable."""
        return {
            'success': True,
            'topics': [
                {
                    'title': 'Global News Update',
                    'description': 'AI services temporarily unavailable. Please check back later.',
                    'category': 'general',
                    'regions': ['Global'],
                    'articles': [],
                    'urgency': 'low',
                    'last_updated': datetime.now().isoformat()
                }
            ],
            'total_topics': 1,
            'total_articles': 0,
            'analysis': {
                'analysis_summary': 'AI services unavailable - fallback mode active',
                'generated_at': datetime.now().isoformat()
            },
            'generated_at': datetime.now().isoformat(),
            'ai_powered': False,
            'fallback': True
        }
    
    def _get_fallback_search(self, query: str) -> Dict[str, Any]:
        """Fallback search when AI services are unavailable."""
        return {
            'success': True,
            'query': query,
            'keywords': [query],
            'perspectives': [],
            'articles': [],
            'total_articles': 0,
            'verification_analysis': {},
            'fact_check': {},
            'searched_at': datetime.now().isoformat(),
            'ai_powered': False,
            'fallback': True,
            'message': 'AI services temporarily unavailable. Please try again later.'
        }

# Singleton instance
ai_orchestrator = AIOrchestrator()