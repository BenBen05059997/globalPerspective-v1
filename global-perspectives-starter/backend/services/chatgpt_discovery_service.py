"""
ChatGPT Discovery Service

This service uses OpenAI's ChatGPT-4 to discover trending topics and identify
local news sources from affected regions for comprehensive global coverage.
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from openai import OpenAI
from datetime import datetime

logger = logging.getLogger(__name__)

class ChatGPTDiscoveryService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        self.model = "gpt-4"
        self.max_sources_per_topic = int(os.getenv('MAX_SOURCES_PER_TOPIC', 5))
        
    def discover_trending_topics(self) -> List[Dict[str, Any]]:
        """
        Discover current trending international topics using ChatGPT.
        
        Returns:
            List of topics with descriptions, regions, sources, and keywords
        """
        try:
            prompt = self._get_trending_topics_prompt()
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a global news analyst specializing in identifying current international events and reliable local news sources."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=2000,
                timeout=15  # 15 second timeout
            )
            
            content = response.choices[0].message.content
            topics = self._parse_topics_response(content)
            
            logger.info(f"Discovered {len(topics)} trending topics")
            return topics
            
        except Exception as e:
            logger.error(f"Error discovering trending topics: {str(e)}")
            return []
    
    def find_local_sources(self, topic: str, region: str) -> List[Dict[str, str]]:
        """
        Find local news sources for a specific topic and region.
        
        Args:
            topic: The news topic to search for
            region: The geographic region or country
            
        Returns:
            List of local news sources with name, URL, and region
        """
        try:
            prompt = f"""
            For the topic "{topic}" in {region}, provide 3-5 reliable LOCAL news sources.
            
            Focus on:
            - Authentic local/regional news outlets
            - Sources that provide local perspective on the topic
            - Credible journalism organizations from that region
            - Avoid international media covering the region
            
            Format as JSON:
            {{
                "sources": [
                    {{"name": "Source Name", "url": "domain.com", "region": "{region}", "language": "language"}}
                ]
            }}
            """
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert on global media and local news sources."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=800,
                timeout=10  # 10 second timeout
            )
            
            content = response.choices[0].message.content
            sources_data = self._parse_json_response(content)
            
            if sources_data and 'sources' in sources_data:
                return sources_data['sources'][:self.max_sources_per_topic]
            
            return []
            
        except Exception as e:
            logger.error(f"Error finding local sources for {topic} in {region}: {str(e)}")
            return []
    
    def generate_search_keywords(self, topic: str) -> List[str]:
        """
        Generate diverse search keywords for a topic.
        
        Args:
            topic: The news topic
            
        Returns:
            List of search keywords
        """
        try:
            prompt = f"""
            Generate 5-8 diverse search keywords for the topic: "{topic}"
            
            Include:
            - Main topic keywords
            - Related terms and synonyms
            - Key people/organizations involved
            - Geographic locations
            - Alternative phrasings
            
            Return as a simple JSON array: ["keyword1", "keyword2", ...]
            """
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a search optimization expert."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.4,
                max_tokens=300,
                timeout=8  # 8 second timeout
            )
            
            content = response.choices[0].message.content
            keywords = self._parse_json_response(content)
            
            if isinstance(keywords, list):
                return keywords[:8]  # Limit to 8 keywords
            
            return []
            
        except Exception as e:
            logger.error(f"Error generating keywords for {topic}: {str(e)}")
            return []
    
    def get_regional_perspectives(self, topic: str) -> List[Dict[str, Any]]:
        """
        Get different regional perspectives on a global topic.
        
        Args:
            topic: The global topic to analyze
            
        Returns:
            List of regional perspectives with sources
        """
        try:
            prompt = f"""
            For the global topic "{topic}", identify 4-6 different regional perspectives.
            
            For each region, provide:
            - Region name
            - Local angle/perspective on the topic
            - 2-3 local news sources
            - Cultural/political context
            
            Format as JSON:
            {{
                "perspectives": [
                    {{
                        "region": "Region Name",
                        "perspective": "Local angle description",
                        "context": "Cultural/political context",
                        "sources": [
                            {{"name": "Source", "url": "domain.com"}}
                        ]
                    }}
                ]
            }}
            """
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a global affairs analyst with expertise in regional perspectives."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1500,
                timeout=12  # 12 second timeout
            )
            
            content = response.choices[0].message.content
            perspectives_data = self._parse_json_response(content)
            
            if perspectives_data and 'perspectives' in perspectives_data:
                return perspectives_data['perspectives']
            
            return []
            
        except Exception as e:
            logger.error(f"Error getting regional perspectives for {topic}: {str(e)}")
            return []
    
    def _get_trending_topics_prompt(self) -> str:
        """Get the main prompt for discovering trending topics."""
        today = datetime.now().strftime("%Y-%m-%d")
        
        return f"""
        What are the top 5 international conflicts or political tensions happening TODAY ({today})? 

        For each, provide: 
        1. Brief description 
        2. Countries/regions involved 
        3. 3-5 reliable LOCAL news sources from those regions 
        4. Suggested search keywords

        Also include 2-3 additional topics from these categories:
        - Economic developments and market impacts
        - Environmental and climate events
        - Social movements and cultural shifts
        - Technology and innovation breakthroughs

        Format as JSON:
        {{
            "topics": [
                {{
                    "title": "Topic Title",
                    "description": "Brief description",
                    "category": "conflict|economic|environmental|social|technology",
                    "regions": ["Country1", "Country2"],
                    "local_sources": [
                        {{"name": "Source Name", "url": "domain.com", "region": "Country"}}
                    ],
                    "search_keywords": ["keyword1", "keyword2"],
                    "urgency": "high|medium|low",
                    "last_updated": "{today}"
                }}
            ]
        }}
        """
    
    def _parse_topics_response(self, content: str) -> List[Dict[str, Any]]:
        """Parse the ChatGPT response for trending topics."""
        try:
            # Try to extract JSON from the response
            data = self._parse_json_response(content)
            
            if data and 'topics' in data:
                return data['topics']
            
            return []
            
        except Exception as e:
            logger.error(f"Error parsing topics response: {str(e)}")
            return []
    
    def _parse_json_response(self, content: str) -> Optional[Dict[str, Any]]:
        """Parse JSON from ChatGPT response, handling markdown code blocks."""
        try:
            # Remove markdown code blocks if present
            if '```json' in content:
                start = content.find('```json') + 7
                end = content.find('```', start)
                content = content[start:end].strip()
            elif '```' in content:
                start = content.find('```') + 3
                end = content.find('```', start)
                content = content[start:end].strip()
            
            # Clean up the content
            content = content.strip()
            
            # Parse JSON
            return json.loads(content)
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {str(e)}")
            logger.error(f"Content: {content[:500]}...")
            return None
        except Exception as e:
            logger.error(f"Error parsing JSON response: {str(e)}")
            return None

# Singleton instance
chatgpt_discovery = ChatGPTDiscoveryService()