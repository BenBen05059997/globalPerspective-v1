"""
AWS Bedrock Agent Service for LLaMA Integration
Handles all AI-powered features using Bedrock Agents
"""

import json
import os
import asyncio
import uuid
from typing import List, Dict, Any, Optional
import boto3
from botocore.exceptions import ClientError, BotoCoreError
import logging

logger = logging.getLogger(__name__)

class BedrockService:
    """AWS Bedrock Agent service for AI interactions with dual agents"""
    
    def __init__(self):
        self.region = os.getenv('AWS_REGION', 'us-west-2')
        
        # Summarization Agent Configuration
        self.summarize_agent_id = os.getenv('BEDROCK_SUMMARIZE_AGENT_ID')
        self.summarize_agent_alias_id = os.getenv('BEDROCK_SUMMARIZE_AGENT_ALIAS_ID', 'TSTALIASID')
        
        # Prediction Agent Configuration
        self.predict_agent_id = os.getenv('BEDROCK_PREDICT_AGENT_ID')
        self.predict_agent_alias_id = os.getenv('BEDROCK_PREDICT_AGENT_ALIAS_ID', 'TSTALIASID')
        
        # Initialize Bedrock Agent Runtime client
        try:
            # Check if a specific AWS profile is configured for Bedrock
            aws_profile = os.getenv('AWS_PROFILE')
            if aws_profile:
                session = boto3.Session(profile_name=aws_profile)
                self.bedrock_agent_client = session.client(
                    'bedrock-agent-runtime',
                    region_name=self.region
                )
            else:
                self.bedrock_agent_client = boto3.client(
                    'bedrock-agent-runtime',
                    region_name=self.region
                    # Using AWS credential chain (IAM roles, ~/.aws/credentials, env vars)
                )
            logger.info(f"Bedrock Agent client initialized for region: {self.region}")
            logger.info(f"Summarize Agent ID: {self.summarize_agent_id}")
            logger.info(f"Predict Agent ID: {self.predict_agent_id}")
        except Exception as e:
            logger.error(f"Failed to initialize Bedrock Agent client: {e}")
            self.bedrock_agent_client = None
    
    async def _invoke_agent(self, input_text: str, agent_id: str, agent_alias_id: str, session_id: Optional[str] = None) -> Optional[str]:
        """
        Invoke specific Bedrock Agent with error handling
        """
        logger.info(f"_invoke_agent called with agent_id: {agent_id}, agent_alias_id: {agent_alias_id}")
        
        if not self.bedrock_agent_client:
            logger.warning("Bedrock Agent client not available, returning None")
            return None
            
        if not agent_id:
            logger.warning(f"Agent ID not configured, returning None")
            return None
        
        try:
            # Generate session ID if not provided
            if not session_id:
                session_id = f"session-{uuid.uuid4()}"
            
            # Invoke the specific agent with minimal parameters
            response = self.bedrock_agent_client.invoke_agent(
                agentId=agent_id,
                agentAliasId=agent_alias_id,
                sessionId=session_id,
                inputText=input_text
            )
            
            # Parse the streaming response
            completion = ""
            if 'completion' in response:
                for event in response['completion']:
                    if 'chunk' in event:
                        chunk = event['chunk']
                        if 'bytes' in chunk:
                            completion += chunk['bytes'].decode('utf-8')
                        elif 'attribution' in chunk:
                            # Handle attribution chunks if present
                            continue
                    elif 'trace' in event:
                        # Handle trace events if present
                        continue
            
            return completion.strip() if completion else None
            
        except ClientError as e:
            logger.error(f"AWS ClientError invoking Bedrock Agent: {e}")
            return None
        except BotoCoreError as e:
            logger.error(f"BotoCoreError invoking Bedrock Agent: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error invoking Bedrock Agent: {e}")
            return None
    
    async def generate_summary(self, title: str, description: str) -> Optional[str]:
        """
        Generate AI-powered summary using Summarization Agent
        """
        logger.info(f"generate_summary called with title: {title[:50]}...")
        logger.info(f"Using summarize_agent_id: {self.summarize_agent_id}")
        logger.info(f"Using summarize_agent_alias_id: {self.summarize_agent_alias_id}")
        
        input_text = f"Summarize this news article: Title: {title}. Description: {description}. Provide a clear, factual summary in 2-3 sentences."
        
        result = await self._invoke_agent(
            input_text, 
            self.summarize_agent_id, 
            self.summarize_agent_alias_id
        )
        
        logger.info(f"generate_summary result: {result}")
        return result
    

    
    async def generate_predictions(self, article: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Generate conflict predictions using Prediction Agent
        """
        title = article.get('title', '')
        description = article.get('description', '')
        summary = article.get('summary', description)
        
        input_text = f"""Analyze this conflict news and predict outcomes: Title: {title}. Description: {description}. Summary: {summary}. 
        Provide JSON response with: escalation_risk (1-10), timeline (e.g. "1-3 months"), key_factors (array), potential_outcomes (array)."""
        
        response = await self._invoke_agent(
            input_text,
            self.predict_agent_id,
            self.predict_agent_alias_id
        )
        
        if response:
            try:
                # Try to parse JSON response
                return json.loads(response)
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse JSON response: {response}")
                return None
        
        return None
    
    async def cluster_topics(self, articles: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Cluster articles by topic using LLaMA
        """
        # Prepare article summaries for clustering
        article_summaries = []
        for i, article in enumerate(articles[:10]):  # Limit to 10 articles for cost
            title = article.get('title', '')[:100]  # Truncate for token efficiency
            article_summaries.append(f"{i+1}. {title}")
        
        articles_text = "\n".join(article_summaries)
        
        prompt = f"""
        <|begin_of_text|><|start_header_id|>system<|end_header_id|>
        You are a topic clustering expert. Group similar news articles by their main topics.
        <|eot_id|>

        <|start_header_id|>user<|end_header_id|>
        Articles:
        {articles_text}
        
        Group these articles by topic and respond with JSON:
        {{
            "clusters": [
                {{
                    "topic": "topic name",
                    "articles": [1, 2, 3],
                    "description": "brief description"
                }}
            ],
            "main_topics": ["topic1", "topic2", "topic3"]
        }}
        <|eot_id|>

        <|start_header_id|>assistant<|end_header_id|>
        """
        
        response = await self._invoke_model(prompt, max_tokens=400)
        if response:
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                logger.warning("Failed to parse clustering JSON response")
        return None
    
    async def batch_process_articles(self, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Process multiple articles with AI summaries using Bedrock Agent
        """
        processed_articles = []
        
        for article in articles:
            try:
                # Generate summary using agent
                title = article.get('title', '')
                description = article.get('description', '')
                summary = await self.generate_summary(title, description)
                
                # Add summary to article
                processed_article = article.copy()
                processed_article['summary'] = summary or "Summary not available"
                processed_articles.append(processed_article)
                
                # Small delay to avoid rate limiting
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Error processing article {article.get('title', 'Unknown')}: {e}")
                # Add article without summary
                processed_article = article.copy()
                processed_article['summary'] = "Summary generation failed"
                processed_articles.append(processed_article)
        
        return processed_articles

# Global instance
bedrock_service = BedrockService()