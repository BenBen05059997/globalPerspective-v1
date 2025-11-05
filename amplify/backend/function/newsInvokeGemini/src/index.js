'use strict';

     const { GoogleGenerativeAI } = require('@google/generative-ai');
     const crypto = require('crypto');

     // Optional DynamoDB: prefer AWS SDK v3; fallback to v2 if available
     let ddbDoc = null;
     let usingAwsSdkV3 = false;
     try {
       const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
       const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
       const ddb = new DynamoDBClient({});
       ddbDoc = DynamoDBDocumentClient.from(ddb);
       usingAwsSdkV3 = true;
     } catch (_) {
       try {
         const AWS = require('aws-sdk');
         ddbDoc = new AWS.DynamoDB.DocumentClient();
       } catch (_ignored) {
         // No AWS SDK available; writes will be skipped gracefully
       }
     }

     const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
     const DEFAULT_LIMIT = 5;
     const CACHE_TABLE = process.env.TOPICS_DDB_TABLE; // e.g., GeminiTopicsCache
     const CACHE_ID = process.env.TOPICS_CACHE_ITEM_ID || 'latest';

     // Try to parse JSON even if the model adds extra text or code fences
     function extractJson(text) {
       try { return JSON.parse(text); } catch (_) {}
       const fenceMatch = text.match(/```json([\s\S]*?)```/i);
       if (fenceMatch) {
         const inner = fenceMatch[1].trim();
         try { return JSON.parse(inner); } catch (_) {}
       }
       const startArr = text.indexOf('[');
       const endArr = text.lastIndexOf(']');
       if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
         const arrStr = text.slice(startArr, endArr + 1);
         try { return JSON.parse(arrStr); } catch (_) {}
       }
       const startObj = text.indexOf('{');
       const endObj = text.lastIndexOf('}');
       if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
         const objStr = text.slice(startObj, endObj + 1);
         try { return JSON.parse(objStr); } catch (_) {}
       }
       throw new Error('Failed to parse JSON from model output');
     }

     function isScheduledEvent(event) {
        return (
         event?.source === 'aws.events' ||
         event?.detailType === 'Scheduled Event' ||
         event?.['detail-type'] === 'Scheduled Event'
       );
     }

      function slugify(value, fallback = '') {
        if (typeof value !== 'string') {
          return fallback;
        }
        return value
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .replace(/-{2,}/g, '-')
          .slice(0, 80) || fallback;
      }

      function normalizeList(input) {
        if (!Array.isArray(input)) {
          return [];
        }
        return input
          .map((entry) => String(entry || '').trim().toLowerCase())
          .filter(Boolean)
          .sort();
      }

      function buildStableTopicId(topic, idx) {
        if (topic?.id) {
          return String(topic.id);
        }
        if (topic?.topicId) {
          return String(topic.topicId);
        }

        const title = String(topic?.title || '').trim();
        const category = String(topic?.category || '').trim();
        const primaryLocation = String(topic?.primary_location || '').trim();
        const regions = normalizeList(topic?.regions);
        const keywords = normalizeList(topic?.search_keywords);

        const payload = JSON.stringify({
          title: title.toLowerCase(),
          category: category.toLowerCase(),
          primaryLocation: primaryLocation.toLowerCase(),
          regions,
          keywords,
        });

        const hash = crypto.createHash('sha1').update(payload || `${idx}`).digest('hex').slice(0, 10);
        const slugBase = slugify(title || primaryLocation || `topic-${idx}`, `topic-${idx}`);
        return `${slugBase}-${hash}`;
      }

      function augmentTopic(rawTopic, idx) {
        const id = buildStableTopicId(rawTopic, idx);
        return {
          id,
          topicId: id,
          title: String(rawTopic?.title || '').trim(),
          category: String(rawTopic?.category || '').trim(),
          search_keywords: Array.isArray(rawTopic?.search_keywords)
            ? rawTopic.search_keywords.map((k) => String(k || '').trim()).filter(Boolean)
            : [],
          regions: Array.isArray(rawTopic?.regions)
            ? rawTopic.regions.map((r) => String(r || '').trim()).filter(Boolean)
            : [],
          primary_location: String(rawTopic?.primary_location || '').trim(),
          location_context: String(rawTopic?.location_context || '').trim(),
        };
      }

      async function writeCache({ topics, model, limit }) {
        if (!ddbDoc || !CACHE_TABLE) {
         const reason = !ddbDoc ? 'No DynamoDB client' : 'No TOPICS_DDB_TABLE env';
         console.log(`Skipping cache write: ${reason}`);
         return { cached: false, reason };
       }

       const updatedAt = new Date().toISOString();
       const item = { id: CACHE_ID, topics, model, limit, updatedAt };

       try {
         console.log(`Attempting DynamoDB cache write: table=${CACHE_TABLE}, id=${CACHE_ID}`);
         if (usingAwsSdkV3) {
           const { PutCommand } = require('@aws-sdk/lib-dynamodb');
           await ddbDoc.send(new PutCommand({ TableName: CACHE_TABLE, Item: item }));
         } else {
           await ddbDoc.put({ TableName: CACHE_TABLE, Item: item }).promise();
         }
         console.log(`DynamoDB cache write OK: id=${CACHE_ID}, updatedAt=${updatedAt}`);
         return { cached: true, updatedAt };
       } catch (e) {
         console.error('DynamoDB put error:', e);
         return { cached: false, reason: e.message };
       }
     }

     exports.handler = async (event) => {
       const headers = {
         'Content-Type': 'application/json',
         'Access-Control-Allow-Origin': '*',
       };

       try {
         const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
         if (!apiKey) {
           const msg = 'Missing GOOGLE_GEMINI_API_KEY environment variable';
           if (isScheduledEvent(event)) {
             console.error(msg);
             return { status: 'error', error: msg };
           }
           return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) };
         }

         const qs = event?.queryStringParameters || {};
         const configuredLimit = parseInt(process.env.TOPICS_LIMIT || DEFAULT_LIMIT, 10) || DEFAULT_LIMIT;
         const limit = isScheduledEvent(event)
           ? Math.max(1, Math.min(20, configuredLimit))
           : Math.max(1, Math.min(20, parseInt(qs.limit || DEFAULT_LIMIT, 10) || DEFAULT_LIMIT));

         const genAI = new GoogleGenerativeAI(apiKey);
         const model = genAI.getGenerativeModel({ model: MODEL_NAME });

         // Get current date for better temporal grounding
         const currentDateString = new Date().toLocaleDateString('en-US', {
           weekday: 'long',
           year: 'numeric',
           month: 'long',
           day: 'numeric',
           timeZone: 'UTC'
         });

         const prompt = [
           `You are an AI assistant with internet search capabilities finding current global news topics for today, ${currentDateString}.`,
           'IMPORTANT: Search the internet extensively for the most recent news from the past 24-48 hours.',
           'You MUST search online and browse news websites to find actual current events.',
           'Return only a JSON array with no commentary.',
           'Each item must be an object with fields:',
           '- title: string (current news headline from your web search)',
           '- category: string (e.g., politics, economy, technology, environment, security, health, culture)',
           '- search_keywords: array of 3-6 short keywords users would search',
           '- regions: array of affected regions or countries (strings)',
           '- primary_location: string (specific geographical location where this story is happening)',
           '- location_context: string (brief explanation of why this location is relevant)',
           `Limit to ${limit} items.`,
           '',
           'INTERNET SEARCH REQUIREMENTS:',
           `1. Today is ${currentDateString}. You must search the internet for current news from the past 24-48 hours.`,
           '2. Browse major news websites: BBC, CNN, Reuters, Associated Press, Al Jazeera, etc.',
           '3. ONLY include topics you can verify from real current news sources online.',
           '4. If no news from past 24-48 hours, then include news from the past week.',
           '5. Each topic MUST be based on actual recent news you found through internet search.',
           '6. DO NOT make up fictional headlines - search and verify everything.',
           '7. Focus on breaking news, current events, and developing stories.',
           '',
           'CRITICAL GEOGRAPHIC REQUIREMENTS:',
           '1. ONLY include topics that have CLEAR, GEOGRAPHICALLY SPECIFIC locations that can be accurately geocoded.',
           '2. EXCLUDE topics that are:',
           '   - Purely abstract or conceptual (e.g., climate policy discussions)',
           '   - General economic trends without specific regional impact',
           '   - Diplomatic meetings where the meeting location is not the main story',
           '   - Tech company news without clear regional deployment/impact',
           '   - Global policy discussions without country-specific implementation',
           '',
           'VALID TOPIC EXAMPLES (include these):',
           '- Ukraine war stories: "Kyiv, Ukraine" or "Eastern Europe" - SPECIFIC geographic conflicts',
           '- Middle East crises: "Rafah, Gaza Strip" or "Tel Aviv" - CLEAR geographic impact zones',
           '- Natural disasters: "Hurricane path, Florida, USA" - PRECISE geographic events',
           '- Regional economic policies: "Sao Paulo, Brazil" or "New Delhi, India" - SPECIFIC locations',
           '- Political events: "Washington DC" for US elections, "Berlin" for German politics',
           '',
           'INVALID TOPIC EXAMPLES (exclude these):',
           '- "Global inflation trends" - no specific location',
           '- "UN climate summit outcomes" - diplomatic meeting, not geographic impact',
           '- "Tech regulation discussions" - abstract policy topics',
           '- "Supply chain concerns" - too generic/geographically vague',
           '- "International AI ethics" - no clear geographic implementation',
           '',
           'For primary_location, you MUST provide location precision that will geocode accurately.',
           'If you cannot identify a specific country, city, or well-defined region for a topic, EXCLUDE it entirely.',
           '',
           'Avoid generic locations. Prioritize impact locations over meeting locations.',
           'Provide location_context explaining WHY this location represents the story\'s geographic impact.'
         ].join('\n');

         // Log the current date for debugging temporal relevance
        console.info(`🌐 Prompting Gemini to search internet for current news up to: ${currentDateString}`);
        
        const result = await model.generateContent(prompt);
         const text =
           (typeof result?.response?.text === 'function' ? result?.response?.text() : null) ||
           result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
           '';

         if (!text) {
           const msg = 'Empty response from Gemini model';
           if (isScheduledEvent(event)) {
             console.error(msg);
             return { status: 'error', error: msg };
           }
           return { statusCode: 502, headers, body: JSON.stringify({ error: msg }) };
         }

         const topics = extractJson(text);

          const normalized = Array.isArray(topics) ? topics.map((t, idx) => augmentTopic(t, idx)) : [];

         const cacheResult = await writeCache({ topics: normalized, model: MODEL_NAME, limit });

         if (isScheduledEvent(event)) {
           return {
             status: 'ok',
             count: normalized.length,
             cached: cacheResult.cached,
             updatedAt: cacheResult.updatedAt || null,
           };
         }

         return {
           statusCode: 200,
           headers,
           body: JSON.stringify({
             topics: normalized,
             ai_powered: true,
             model: MODEL_NAME,
             limit,
             cached: cacheResult.cached,
             updatedAt: cacheResult.updatedAt || null,
           }),
         };
       } catch (err) {
         console.error('Gemini Lambda error:', err);
         if (isScheduledEvent(event)) {
           return { status: 'error', error: err?.message || 'Unexpected error' };
         }
         return { statusCode: 500, headers, body: JSON.stringify({ error: err?.message || 'Unexpected error' }) };
       }
     };
