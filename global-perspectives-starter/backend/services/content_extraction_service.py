"""
Content Extraction Service

This service handles scraping and extracting content from news articles,
with intelligent parsing and content cleaning capabilities.
"""

import os
import time
import logging
import requests
from typing import Dict, Any, List, Optional
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from datetime import datetime
import re

logger = logging.getLogger(__name__)

class ContentExtractionService:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.scraping_delay = float(os.getenv('SCRAPING_DELAY_SECONDS', 1.0))
        self.timeout = 30
        
    def extract_article_content(self, url: str) -> Dict[str, Any]:
        """
        Extract content from a news article URL.
        
        Args:
            url: The URL of the article to extract
            
        Returns:
            Dictionary with extracted content and metadata
        """
        try:
            # Add delay to be respectful to servers
            time.sleep(self.scraping_delay)
            
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract article data
            article_data = {
                'url': url,
                'title': self._extract_title(soup),
                'content': self._extract_content(soup),
                'author': self._extract_author(soup),
                'publish_date': self._extract_publish_date(soup),
                'description': self._extract_description(soup),
                'image_url': self._extract_image_url(soup, url),
                'source_name': self._extract_source_name(soup, url),
                'language': self._detect_language(soup),
                'word_count': 0,
                'extracted_at': datetime.now().isoformat(),
                'extraction_success': True
            }
            
            # Calculate word count
            if article_data['content']:
                article_data['word_count'] = len(article_data['content'].split())
            
            # Validate extraction
            if not article_data['title'] and not article_data['content']:
                article_data['extraction_success'] = False
                article_data['error'] = 'Failed to extract title or content'
            
            logger.info(f"Successfully extracted article: {article_data['title'][:50]}...")
            return article_data
            
        except requests.RequestException as e:
            logger.error(f"Request error extracting {url}: {str(e)}")
            return self._get_extraction_error(url, f"Request failed: {str(e)}")
        except Exception as e:
            logger.error(f"Error extracting article from {url}: {str(e)}")
            return self._get_extraction_error(url, f"Extraction failed: {str(e)}")
    
    def extract_multiple_articles(self, urls: List[str]) -> List[Dict[str, Any]]:
        """
        Extract content from multiple article URLs.
        
        Args:
            urls: List of URLs to extract
            
        Returns:
            List of extracted article data
        """
        articles = []
        
        for url in urls:
            try:
                article = self.extract_article_content(url)
                articles.append(article)
                
                # Add delay between requests
                if len(articles) < len(urls):
                    time.sleep(self.scraping_delay)
                    
            except Exception as e:
                logger.error(f"Error extracting {url}: {str(e)}")
                articles.append(self._get_extraction_error(url, str(e)))
        
        logger.info(f"Extracted {len(articles)} articles")
        return articles
    
    def search_articles_by_keywords(self, source_url: str, keywords: List[str]) -> List[Dict[str, Any]]:
        """
        Search for articles on a news source using keywords.
        
        Args:
            source_url: Base URL of the news source
            keywords: List of keywords to search for
            
        Returns:
            List of found articles with URLs and basic metadata
        """
        try:
            # Try common search patterns
            search_urls = self._generate_search_urls(source_url, keywords)
            found_articles = []
            
            for search_url in search_urls:
                try:
                    time.sleep(self.scraping_delay)
                    response = self.session.get(search_url, timeout=self.timeout)
                    response.raise_for_status()
                    
                    soup = BeautifulSoup(response.content, 'html.parser')
                    articles = self._extract_article_links(soup, source_url)
                    
                    found_articles.extend(articles)
                    
                    if len(found_articles) >= 10:  # Limit results
                        break
                        
                except Exception as e:
                    logger.warning(f"Search failed for {search_url}: {str(e)}")
                    continue
            
            # Remove duplicates
            unique_articles = []
            seen_urls = set()
            
            for article in found_articles:
                if article['url'] not in seen_urls:
                    unique_articles.append(article)
                    seen_urls.add(article['url'])
            
            logger.info(f"Found {len(unique_articles)} articles for keywords: {keywords}")
            return unique_articles[:10]  # Return top 10
            
        except Exception as e:
            logger.error(f"Error searching articles: {str(e)}")
            return []
    
    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract article title from HTML."""
        # Try multiple selectors
        selectors = [
            'h1',
            '[data-testid="headline"]',
            '.headline',
            '.article-title',
            '.entry-title',
            'title'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element and element.get_text().strip():
                return element.get_text().strip()
        
        return ""
    
    def _extract_content(self, soup: BeautifulSoup) -> str:
        """Extract main article content from HTML."""
        # Remove unwanted elements
        for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'advertisement']):
            element.decompose()
        
        # Try multiple content selectors
        content_selectors = [
            '[data-testid="article-body"]',
            '.article-body',
            '.entry-content',
            '.post-content',
            '.content',
            'article',
            '.story-body',
            '.article-content'
        ]
        
        for selector in content_selectors:
            content_element = soup.select_one(selector)
            if content_element:
                # Extract text from paragraphs
                paragraphs = content_element.find_all('p')
                if paragraphs:
                    content = '\n\n'.join([p.get_text().strip() for p in paragraphs if p.get_text().strip()])
                    if len(content) > 100:  # Minimum content length
                        return content
        
        # Fallback: extract all paragraphs
        paragraphs = soup.find_all('p')
        if paragraphs:
            content = '\n\n'.join([p.get_text().strip() for p in paragraphs if p.get_text().strip()])
            return content
        
        return ""
    
    def _extract_author(self, soup: BeautifulSoup) -> str:
        """Extract article author from HTML."""
        author_selectors = [
            '[data-testid="author"]',
            '.author',
            '.byline',
            '.article-author',
            '[rel="author"]',
            '.writer'
        ]
        
        for selector in author_selectors:
            element = soup.select_one(selector)
            if element and element.get_text().strip():
                return element.get_text().strip()
        
        return ""
    
    def _extract_publish_date(self, soup: BeautifulSoup) -> str:
        """Extract publish date from HTML."""
        # Try meta tags first
        meta_selectors = [
            'meta[property="article:published_time"]',
            'meta[name="publish-date"]',
            'meta[name="date"]',
            'meta[property="og:published_time"]'
        ]
        
        for selector in meta_selectors:
            element = soup.select_one(selector)
            if element and element.get('content'):
                return element.get('content')
        
        # Try time elements
        time_element = soup.select_one('time[datetime]')
        if time_element and time_element.get('datetime'):
            return time_element.get('datetime')
        
        return ""
    
    def _extract_description(self, soup: BeautifulSoup) -> str:
        """Extract article description from HTML."""
        meta_selectors = [
            'meta[name="description"]',
            'meta[property="og:description"]',
            'meta[name="twitter:description"]'
        ]
        
        for selector in meta_selectors:
            element = soup.select_one(selector)
            if element and element.get('content'):
                return element.get('content')
        
        return ""
    
    def _extract_image_url(self, soup: BeautifulSoup, base_url: str) -> str:
        """Extract main image URL from HTML."""
        # Try meta tags
        meta_selectors = [
            'meta[property="og:image"]',
            'meta[name="twitter:image"]',
            'meta[property="article:image"]'
        ]
        
        for selector in meta_selectors:
            element = soup.select_one(selector)
            if element and element.get('content'):
                img_url = element.get('content')
                return urljoin(base_url, img_url)
        
        # Try img elements in article
        img_element = soup.select_one('article img, .article-body img, .content img')
        if img_element and img_element.get('src'):
            return urljoin(base_url, img_element.get('src'))
        
        return ""
    
    def _extract_source_name(self, soup: BeautifulSoup, url: str) -> str:
        """Extract source name from HTML or URL."""
        # Try meta tags
        meta_selectors = [
            'meta[property="og:site_name"]',
            'meta[name="application-name"]',
            'meta[name="site_name"]'
        ]
        
        for selector in meta_selectors:
            element = soup.select_one(selector)
            if element and element.get('content'):
                return element.get('content')
        
        # Fallback to domain name
        domain = urlparse(url).netloc
        return domain.replace('www.', '')
    
    def _detect_language(self, soup: BeautifulSoup) -> str:
        """Detect article language from HTML."""
        # Try html lang attribute
        html_element = soup.find('html')
        if html_element and html_element.get('lang'):
            return html_element.get('lang')
        
        # Try meta tags
        meta_element = soup.select_one('meta[name="language"]')
        if meta_element and meta_element.get('content'):
            return meta_element.get('content')
        
        return "unknown"
    
    def _generate_search_urls(self, source_url: str, keywords: List[str]) -> List[str]:
        """Generate search URLs for a news source."""
        search_urls = []
        query = ' '.join(keywords[:3])  # Use first 3 keywords
        
        # Common search patterns
        patterns = [
            f"{source_url}/search?q={query}",
            f"{source_url}/search/{query}",
            f"{source_url}/?s={query}",
            f"{source_url}/tag/{keywords[0]}" if keywords else None
        ]
        
        for pattern in patterns:
            if pattern:
                search_urls.append(pattern)
        
        return search_urls
    
    def _extract_article_links(self, soup: BeautifulSoup, base_url: str) -> List[Dict[str, Any]]:
        """Extract article links from search results."""
        articles = []
        
        # Find article links
        link_selectors = [
            'a[href*="/article/"]',
            'a[href*="/news/"]',
            'a[href*="/story/"]',
            '.article-link',
            '.headline a',
            'h2 a',
            'h3 a'
        ]
        
        for selector in link_selectors:
            links = soup.select(selector)
            for link in links:
                href = link.get('href')
                title = link.get_text().strip()
                
                if href and title and len(title) > 10:
                    full_url = urljoin(base_url, href)
                    articles.append({
                        'url': full_url,
                        'title': title,
                        'found_at': datetime.now().isoformat()
                    })
        
        return articles
    
    def _get_extraction_error(self, url: str, error_message: str) -> Dict[str, Any]:
        """Return error structure for failed extractions."""
        return {
            'url': url,
            'title': '',
            'content': '',
            'author': '',
            'publish_date': '',
            'description': '',
            'image_url': '',
            'source_name': '',
            'language': 'unknown',
            'word_count': 0,
            'extracted_at': datetime.now().isoformat(),
            'extraction_success': False,
            'error': error_message
        }

# Singleton instance
content_extractor = ContentExtractionService()