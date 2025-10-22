"""
Google Gemini Verification Service

This service uses Google's Gemini AI to verify content authenticity,
analyze bias, and provide credibility scores for news articles.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
import google.generativeai as genai
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

logger = logging.getLogger(__name__)

class GeminiVerificationService:
    def __init__(self):
        api_key = os.getenv('GOOGLE_GEMINI_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-2.0-flash')
        else:
            self.model = None
            logger.warning("Google Gemini API key not found")
        self.executor = ThreadPoolExecutor(max_workers=2)
    
    def _generate_content_with_timeout(self, prompt: str, timeout: int = 15) -> str:
        """
        Generate content with timeout handling.
        
        Args:
            prompt: The prompt to send to Gemini
            timeout: Timeout in seconds
            
        Returns:
            Generated content text
            
        Raises:
            TimeoutError: If the request times out
        """
        if not self.model:
            raise Exception("Gemini model not available")
        
        try:
            future = self.executor.submit(self.model.generate_content, prompt)
            response = future.result(timeout=timeout)
            return response.text
        except FuturesTimeoutError:
            raise TimeoutError(f"Gemini API call timed out after {timeout} seconds")
        except Exception as e:
            raise Exception(f"Gemini API error: {str(e)}")
    
    def verify_article_authenticity(self, article_content: str, source_url: str) -> Dict[str, Any]:
        """
        Verify the authenticity and credibility of a news article.
        
        Args:
            article_content: The full text content of the article
            source_url: The URL of the article source
            
        Returns:
            Dictionary with authenticity score, analysis, and recommendations
        """
        if not self.model:
            return self._get_fallback_verification()
        
        try:
            prompt = f"""
            Analyze this news article for authenticity and credibility:
            
            Source URL: {source_url}
            Content: {article_content[:2000]}...
            
            Evaluate:
            1. Factual accuracy indicators
            2. Source credibility
            3. Bias detection
            4. Sensationalism level
            5. Evidence quality
            6. Writing style professionalism
            
            Provide analysis in JSON format:
            {{
                "authenticity_score": 0-100,
                "credibility_level": "high|medium|low",
                "bias_analysis": {{
                    "political_bias": "left|center|right|unknown",
                    "bias_strength": "strong|moderate|minimal|none",
                    "bias_indicators": ["indicator1", "indicator2"]
                }},
                "quality_indicators": {{
                    "has_sources": true/false,
                    "has_quotes": true/false,
                    "factual_claims": true/false,
                    "sensationalism": "high|medium|low|none"
                }},
                "red_flags": ["flag1", "flag2"],
                "strengths": ["strength1", "strength2"],
                "recommendation": "trust|verify|caution|avoid",
                "summary": "Brief analysis summary"
            }}
            """
            
            response_text = self._generate_content_with_timeout(prompt, timeout=15)
            analysis = self._parse_json_response(response_text)
            
            if analysis:
                analysis['verified_at'] = datetime.now().isoformat()
                analysis['source_url'] = source_url
                return analysis
            
            return self._get_fallback_verification()
            
        except Exception as e:
            logger.error(f"Error verifying article authenticity: {str(e)}")
            return self._get_fallback_verification()
    
    def analyze_source_credibility(self, source_name: str, source_url: str) -> Dict[str, Any]:
        """
        Analyze the credibility of a news source.
        
        Args:
            source_name: Name of the news source
            source_url: URL of the news source
            
        Returns:
            Dictionary with credibility analysis
        """
        if not self.model:
            return self._get_fallback_source_analysis()
        
        try:
            prompt = f"""
            Analyze the credibility of this news source:
            
            Source Name: {source_name}
            Source URL: {source_url}
            
            Evaluate:
            1. Reputation and history
            2. Editorial standards
            3. Fact-checking practices
            4. Transparency
            5. Bias tendencies
            6. Regional/international recognition
            
            Provide analysis in JSON format:
            {{
                "credibility_score": 0-100,
                "reputation_level": "excellent|good|fair|poor|unknown",
                "editorial_quality": "high|medium|low|unknown",
                "bias_profile": {{
                    "political_lean": "left|center|right|mixed|unknown",
                    "factual_reporting": "very_high|high|mixed|low|very_low",
                    "bias_rating": "minimal|low|moderate|high|extreme"
                }},
                "strengths": ["strength1", "strength2"],
                "concerns": ["concern1", "concern2"],
                "regional_focus": "local|national|international|global",
                "language": "language_code",
                "trust_indicators": ["indicator1", "indicator2"],
                "recommendation": "highly_trusted|trusted|use_caution|not_recommended",
                "notes": "Additional context or notes"
            }}
            """
            
            response_text = self._generate_content_with_timeout(prompt, timeout=12)
            analysis = self._parse_json_response(response_text)
            
            if analysis:
                analysis['analyzed_at'] = datetime.now().isoformat()
                analysis['source_name'] = source_name
                analysis['source_url'] = source_url
                return analysis
            
            return self._get_fallback_source_analysis()
            
        except Exception as e:
            logger.error(f"Error analyzing source credibility: {str(e)}")
            return self._get_fallback_source_analysis()
    
    def detect_misinformation_patterns(self, articles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Detect misinformation patterns across multiple articles.
        
        Args:
            articles: List of articles with content and metadata
            
        Returns:
            Dictionary with pattern analysis
        """
        if not self.model or not articles:
            return self._get_fallback_pattern_analysis()
        
        try:
            # Prepare article summaries for analysis
            article_summaries = []
            for i, article in enumerate(articles[:5]):  # Limit to 5 articles
                summary = f"Article {i+1}: {article.get('title', 'No title')}\n"
                summary += f"Source: {article.get('source', 'Unknown')}\n"
                summary += f"Content: {article.get('content', '')[:300]}...\n"
                article_summaries.append(summary)
            
            prompt = f"""
            Analyze these articles for misinformation patterns:
            
            {chr(10).join(article_summaries)}
            
            Look for:
            1. Contradictory information
            2. Unverified claims
            3. Emotional manipulation
            4. Source reliability issues
            5. Fact vs opinion mixing
            6. Conspiracy theories
            
            Provide analysis in JSON format:
            {{
                "overall_reliability": "high|medium|low",
                "consistency_score": 0-100,
                "misinformation_risk": "low|medium|high|critical",
                "patterns_detected": [
                    {{
                        "pattern_type": "contradiction|unverified_claim|bias|manipulation",
                        "description": "Pattern description",
                        "affected_articles": [1, 2],
                        "severity": "low|medium|high"
                    }}
                ],
                "fact_check_needed": ["claim1", "claim2"],
                "reliable_sources": [1, 3],
                "questionable_sources": [2, 4],
                "recommendations": ["recommendation1", "recommendation2"],
                "summary": "Overall assessment"
            }}
            """
            
            response_text = self._generate_content_with_timeout(prompt, timeout=18)
            analysis = self._parse_json_response(response_text)
            
            if analysis:
                analysis['analyzed_at'] = datetime.now().isoformat()
                analysis['articles_count'] = len(articles)
                return analysis
            
            return self._get_fallback_pattern_analysis()
            
        except Exception as e:
            logger.error(f"Error detecting misinformation patterns: {str(e)}")
            return self._get_fallback_pattern_analysis()
    
    def generate_fact_check_summary(self, topic: str, articles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate a fact-check summary for a topic based on multiple articles.
        
        Args:
            topic: The topic being fact-checked
            articles: List of articles about the topic
            
        Returns:
            Dictionary with fact-check summary
        """
        if not self.model or not articles:
            return self._get_fallback_fact_check()
        
        try:
            # Prepare article data
            article_data = []
            for article in articles[:3]:  # Limit to 3 articles
                data = f"Title: {article.get('title', 'No title')}\n"
                data += f"Source: {article.get('source', 'Unknown')}\n"
                data += f"Content: {article.get('content', '')[:500]}...\n"
                article_data.append(data)
            
            prompt = f"""
            Create a fact-check summary for the topic: "{topic}"
            
            Based on these articles:
            {chr(10).join(article_data)}
            
            Provide:
            1. Key facts that are consistently reported
            2. Conflicting information
            3. Unverified claims
            4. Source reliability assessment
            5. Overall truth assessment
            
            Format as JSON:
            {{
                "topic": "{topic}",
                "overall_accuracy": "high|medium|low|disputed",
                "confidence_level": 0-100,
                "verified_facts": ["fact1", "fact2"],
                "disputed_claims": ["claim1", "claim2"],
                "unverified_information": ["info1", "info2"],
                "source_reliability": {{
                    "highly_reliable": ["source1"],
                    "moderately_reliable": ["source2"],
                    "questionable": ["source3"]
                }},
                "consensus_view": "Description of consensus",
                "areas_of_disagreement": ["area1", "area2"],
                "fact_check_verdict": "true|mostly_true|mixed|mostly_false|false|unverifiable",
                "explanation": "Detailed explanation of the verdict",
                "last_updated": "{datetime.now().isoformat()}"
            }}
            """
            
            response_text = self._generate_content_with_timeout(prompt, timeout=15)
            summary = self._parse_json_response(response_text)
            
            if summary:
                return summary
            
            return self._get_fallback_fact_check()

        except Exception as e:
            logger.error(f"Error generating fact-check summary: {str(e)}")
            return self._get_fallback_fact_check()

    def discover_trending_topics(self) -> List[Dict[str, Any]]:
        """
        Discover today's trending international topics using Google Gemini.
        Returns a list of topic dicts with fields: title, category, description,
        search_keywords (list[str]), regions (list[str]).
        """
        if not self.model:
            return []

        today = datetime.now().strftime("%Y-%m-%d")
        prompt = (
            f"What are the top 5 international conflicts or political tensions happening TODAY ({today})? "
            "For each, provide: 1) Brief description, 2) Countries/regions involved, "
            "3) Suggested search keywords. Also include 2-3 additional topics from: "
            "economic, environmental, social, technology.\n\n"
            "Return ONLY JSON with this exact shape:\n"
            "{\n  \"topics\": [\n    {\n      \"title\": \"Topic Title\",\n      \"description\": \"Brief description\",\n      \"category\": \"conflict|economic|environmental|social|technology\",\n      \"regions\": [\"Country1\", \"Country2\"],\n      \"search_keywords\": [\"keyword1\", \"keyword2\"]\n    }\n  ]\n}\n"
        )

        try:
            response_text = self._generate_content_with_timeout(prompt, timeout=12)
            data = self._parse_json_response(response_text)
            topics = []
            if data and isinstance(data, dict):
                raw_topics = data.get("topics") or []
                for t in raw_topics:
                    if not isinstance(t, dict):
                        continue
                    title = t.get("title") or ""
                    description = t.get("description") or ""
                    category = t.get("category") or "General"
                    regions = t.get("regions") or []
                    search_keywords = t.get("search_keywords") or []
                    if title:
                        topics.append({
                            "title": title,
                            "description": description,
                            "category": category,
                            "regions": [str(r) for r in regions if r],
                            "search_keywords": [str(k) for k in search_keywords if k],
                            "last_updated": today
                        })
            return topics
        except Exception as e:
            logger.error(f"Error discovering trending topics with Gemini: {str(e)}")
            return []
    
    def _parse_json_response(self, content: str) -> Optional[Dict[str, Any]]:
        """Parse JSON from Gemini response, handling markdown code blocks."""
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
    
    def _get_fallback_verification(self) -> Dict[str, Any]:
        """Fallback verification when Gemini is unavailable."""
        return {
            "authenticity_score": 50,
            "credibility_level": "unknown",
            "bias_analysis": {
                "political_bias": "unknown",
                "bias_strength": "unknown",
                "bias_indicators": []
            },
            "quality_indicators": {
                "has_sources": False,
                "has_quotes": False,
                "factual_claims": False,
                "sensationalism": "unknown"
            },
            "red_flags": [],
            "strengths": [],
            "recommendation": "verify",
            "summary": "Verification unavailable - manual review recommended",
            "verified_at": datetime.now().isoformat(),
            "fallback": True
        }
    
    def _get_fallback_source_analysis(self) -> Dict[str, Any]:
        """Fallback source analysis when Gemini is unavailable."""
        return {
            "credibility_score": 50,
            "reputation_level": "unknown",
            "editorial_quality": "unknown",
            "bias_profile": {
                "political_lean": "unknown",
                "factual_reporting": "unknown",
                "bias_rating": "unknown"
            },
            "strengths": [],
            "concerns": [],
            "regional_focus": "unknown",
            "language": "unknown",
            "trust_indicators": [],
            "recommendation": "use_caution",
            "notes": "Analysis unavailable - manual verification recommended",
            "analyzed_at": datetime.now().isoformat(),
            "fallback": True
        }
    
    def _get_fallback_pattern_analysis(self) -> Dict[str, Any]:
        """Fallback pattern analysis when Gemini is unavailable."""
        return {
            "overall_reliability": "unknown",
            "consistency_score": 50,
            "misinformation_risk": "medium",
            "patterns_detected": [],
            "fact_check_needed": [],
            "reliable_sources": [],
            "questionable_sources": [],
            "recommendations": ["Manual verification recommended"],
            "summary": "Pattern analysis unavailable",
            "analyzed_at": datetime.now().isoformat(),
            "fallback": True
        }
    
    def _get_fallback_fact_check(self) -> Dict[str, Any]:
        """Fallback fact-check when Gemini is unavailable."""
        return {
            "overall_accuracy": "unknown",
            "confidence_level": 0,
            "verified_facts": [],
            "disputed_claims": [],
            "unverified_information": [],
            "source_reliability": {
                "highly_reliable": [],
                "moderately_reliable": [],
                "questionable": []
            },
            "consensus_view": "Analysis unavailable",
            "areas_of_disagreement": [],
            "fact_check_verdict": "unverifiable",
            "explanation": "Fact-check analysis unavailable - manual verification recommended",
            "last_updated": datetime.now().isoformat(),
            "fallback": True
        }

# Singleton instance
gemini_verification = GeminiVerificationService()