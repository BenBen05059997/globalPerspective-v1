"""
AWS Lambda Service via GraphQL Integration
Replaces direct Bedrock calls with Lambda function invocation through GraphQL
"""

import json
import os
import asyncio
import aiohttp
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class LambdaService:
    """AWS Lambda service via GraphQL for AI interactions"""
    
    def __init__(self):
        # GraphQL configuration (no secrets committed)
        # Read from environment only; fail clearly if missing
        self.graphql_endpoint = os.getenv('GRAPHQL_ENDPOINT') or os.getenv('APPSYNC_ENDPOINT') or ''
        self.api_key = os.getenv('GRAPHQL_API_KEY') or os.getenv('APPSYNC_API_KEY') or ''

        if not self.graphql_endpoint or not self.api_key:
            logger.warning('LambdaService: GRAPHQL_ENDPOINT/APPSYNC_ENDPOINT or GRAPHQL_API_KEY/APPSYNC_API_KEY not set')
        
        # GraphQL mutation
        self.invoke_llm_mutation = """
        mutation InvokeLLM($prompt: String!, $max_tokens: Int, $temperature: Float) {
            invokeLLM(
                prompt: $prompt
                max_tokens: $max_tokens
                temperature: $temperature
            )
        }
        """
        
        logger.info(f"Lambda service initialized with GraphQL endpoint: {self.graphql_endpoint}")
    
    async def _invoke_lambda_via_graphql(self, prompt: str, max_tokens: int = 1000, temperature: float = 0.7) -> Optional[Dict[str, Any]]:
        """
        Invoke Lambda function via GraphQL mutation
        """
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': self.api_key
        }
        
        payload = {
            'query': self.invoke_llm_mutation,
            'variables': {
                'prompt': prompt,
                'max_tokens': max_tokens,
                'temperature': temperature
            }
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.graphql_endpoint,
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    
                    if response.status != 200:
                        logger.error(f"GraphQL request failed with status {response.status}")
                        return None
                    
                    result = await response.json()
                    
                    if 'errors' in result:
                        logger.error(f"GraphQL errors: {result['errors']}")
                        return None
                    
                    if 'data' in result and 'invokeLLM' in result['data']:
                        # Parse the JSON response from Lambda
                        lambda_response = json.loads(result['data']['invokeLLM'])
                        return lambda_response
                    
                    logger.error(f"Unexpected GraphQL response format: {result}")
                    return None
                    
        except asyncio.TimeoutError:
            logger.error("GraphQL request timed out")
            return None
        except Exception as e:
            logger.error(f"GraphQL request failed: {e}")
            return None
    
    async def generate_summary(self, title: str, description: str) -> Optional[str]:
        """
        Generate article summary using Lambda function
        """
        prompt = f"""Please provide a concise summary of this news article:

Title: {title}
Description: {description}

Summary:"""
        
        try:
            response = await self._invoke_lambda_via_graphql(prompt, max_tokens=500, temperature=0.7)
            
            if not response:
                logger.warning("No response from Lambda for summary generation")
                return None
            
            # Extract summary from response
            # Handle Lambda response structure: {statusCode, headers, body}
            if 'body' in response:
                try:
                    body = json.loads(response['body']) if isinstance(response['body'], str) else response['body']
                    if 'model_response' in body:
                        return body['model_response']
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse Lambda response body: {response['body']}")
            
            # Fallback to other response formats
            if 'summary' in response:
                return response['summary']
            elif 'response' in response:
                return response['response']
            elif isinstance(response, str):
                return response
            else:
                logger.warning(f"Unexpected summary response format: {response}")
                return "Summary generated via Lambda"
                
        except Exception as e:
            logger.error(f"Summary generation failed: {e}")
            return None
    
    async def generate_predictions(self, article: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Generate predictions for an article using Lambda function
        """
        prompt = f"""Analyze this news article and provide predictions about its potential impact:

Title: {article.get('title', '')}
Description: {article.get('description', article.get('summary', ''))}
Source: {article.get('source', 'Unknown')}

Please provide:
1. Potential societal impact
2. Economic implications
3. Political ramifications
4. Timeline of effects

Analysis:"""
        
        try:
            response = await self._invoke_lambda_via_graphql(prompt, max_tokens=800, temperature=0.8)
            
            if not response:
                logger.warning("No response from Lambda for prediction generation")
                return None
            
            # Structure the prediction response
            if isinstance(response, dict):
                # Unwrap Lambda proxy envelope if present: {statusCode, headers, body}
                if 'body' in response:
                    try:
                        body = json.loads(response['body']) if isinstance(response['body'], str) else response['body']
                        # Prefer model_response if provided by Lambda
                        impact_text = body.get('model_response') or body.get('response') or ''
                        if isinstance(impact_text, str):
                            impact_text = impact_text.replace('\\n', '\n').replace('\\t', '\t').replace('\"', '"').replace("\\'", "'")
                        structured_response = {
                            'impact_analysis': impact_text or str(body),
                            'confidence_score': body.get('confidence_score', 0.8),
                            'timeline': body.get('timeline', 'Short to medium term'),
                            'categories': body.get('categories', ['general'])
                        }
                        return structured_response
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse Lambda response body: {response['body']}")
                        # Fall through to generic handling
                
                # Generic handling when response is already structured
                impact_text = response.get('impact_analysis', response.get('response', str(response)))
                if isinstance(impact_text, str):
                    # Clean up escaped newlines and other escape sequences
                    impact_text = impact_text.replace('\\\\n', '\n').replace('\\n', '\n')
                    impact_text = impact_text.replace('\\\\t', '\t').replace('\\t', '\t')
                    impact_text = impact_text.replace('\\"', '"').replace("\\'", "'")
                structured_response = {
                    'impact_analysis': impact_text,
                    'confidence_score': response.get('confidence_score', 0.8),
                    'timeline': response.get('timeline', 'Short to medium term'),
                    'categories': response.get('categories', ['general'])
                }
                return structured_response
            else:
                # Clean up the string response
                impact_text = str(response)
                impact_text = impact_text.replace('\\\\n', '\n').replace('\\n', '\n')
                impact_text = impact_text.replace('\\\\t', '\t').replace('\\t', '\t')
                impact_text = impact_text.replace('\\"', '"').replace("\\'", "'")
                
                structured_response = {
                    'impact_analysis': impact_text,
                    'confidence_score': 0.8,
                    'timeline': 'Short to medium term',
                    'categories': ['general']
                }
                return structured_response
                
        except Exception as e:
            logger.error(f"Prediction generation failed: {e}")
            return None
    
    async def cluster_topics(self, articles: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Cluster topics using Lambda function
        """
        articles_text = []
        for article in articles[:10]:  # Limit to 10 articles to avoid token limits
            title = article.get('title', '')
            description = article.get('description', article.get('summary', ''))
            articles_text.append(f"Title: {title}\nDescription: {description}")
        
        combined_text = '\n\n---\n\n'.join(articles_text)
        
        prompt = f"""Analyze these news articles and group them into thematic clusters:

{combined_text}

Please identify:
1. Main themes/topics
2. Article groupings
3. Relationship patterns
4. Key insights

Analysis:"""
        
        try:
            response = await self._invoke_lambda_via_graphql(prompt, max_tokens=1000, temperature=0.6)
            
            if not response:
                logger.warning("No response from Lambda for topic clustering")
                return None
            
            if isinstance(response, dict):
                return {
                    'clusters': response.get('clusters', []),
                    'themes': response.get('themes', []),
                    'insights': response.get('insights', response.get('response', str(response)))
                }
            else:
                return {
                    'clusters': [],
                    'themes': [],
                    'insights': str(response)
                }
                
        except Exception as e:
            logger.error(f"Topic clustering failed: {e}")
            return None
    
    async def batch_process_articles(self, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Process multiple articles using Lambda function
        """
        processed_articles = []
        
        # Process articles in batches to avoid overwhelming the Lambda
        batch_size = 5
        for i in range(0, len(articles), batch_size):
            batch = articles[i:i + batch_size]
            
            # Process each article in the batch
            batch_tasks = []
            for article in batch:
                # Add summary task
                summary_task = self.generate_summary(
                    article.get('title', ''),
                    article.get('description', '')
                )
                batch_tasks.append(summary_task)
            
            # Wait for batch to complete
            try:
                summaries = await asyncio.gather(*batch_tasks, return_exceptions=True)
                
                # Combine results with original articles
                for j, article in enumerate(batch):
                    processed_article = article.copy()
                    
                    # Add summary if successful
                    if j < len(summaries) and not isinstance(summaries[j], Exception):
                        processed_article['ai_summary'] = summaries[j]
                    else:
                        processed_article['ai_summary'] = None
                    
                    processed_articles.append(processed_article)
                    
            except Exception as e:
                logger.error(f"Batch processing failed: {e}")
                # Add articles without AI processing
                processed_articles.extend(batch)
            
            # Small delay between batches
            await asyncio.sleep(0.5)
        
        return processed_articles
    
    async def test_connection(self) -> bool:
        """
        Test the GraphQL Lambda connection
        """
        try:
            response = await self._invoke_lambda_via_graphql("Test connection", max_tokens=50, temperature=0.5)
            if response:
                logger.info("Lambda service connection test successful")
                return True
            else:
                logger.error("Lambda service connection test failed")
                return False
        except Exception as e:
            logger.error(f"Lambda service connection test failed: {e}")
            return False

# Export singleton instance
lambda_service = LambdaService()