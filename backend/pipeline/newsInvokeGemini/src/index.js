'use strict';

const { chat } = require('./_shared/llm');
const { captureRawArticles } = require('./rawCapture');
const { makeS3Json } = require('./_shared/s3json');
// The selection rules (feeds, prompt, validation, filters, seen list) live in selection.js, shared with the recovery script (decision 0061).
const {
  FEED_FETCH_CAP, FOLLOWED_DAYS, RSS_FEEDS, shouldFilterArticle, buildSelectionPrompt, dedupeByUrl, freshSeen, nextSeenEntries,
  followedStories, selectionRequest, selectionChatOptions, processSelection,
  canonicalIso3, normalizeSourceUrl, filterTopics, capTopics, extractJson,
} = require('./selection');

// AWS SDK v3 is provided by the Lambda Node.js runtime.
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const MODEL_NAME = process.env.GROK_MODEL || 'deepseek-v4-pro'; // fallback only; the env sets the live model
const DEFAULT_LIMIT = 15;
const CACHE_TABLE = process.env.TOPICS_DDB_TABLE;
const WORLD_BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const CACHE_ID = process.env.TOPICS_CACHE_ITEM_ID || 'staging';

// ============================================================
// SEEN TOPICS - 24h soft dedup
// ============================================================

const SEEN_TOPICS_ID = 'seen-today';

async function readSeenTopics() {
  if (!CACHE_TABLE) return [];
  try {
    const result = await ddbDoc.send(new GetCommand({ TableName: CACHE_TABLE, Key: { id: SEEN_TOPICS_ID } }));
    const item = result?.Item;
    if (!item || !Array.isArray(item.entries)) return [];
    return freshSeen(item.entries, Date.now());
  } catch (err) {
    console.warn('Failed to read seen topics:', err.message);
    return [];
  }
}

async function writeSeenTopics(entries) {
  if (!CACHE_TABLE) return;
  try {
    const item = {
      id: SEEN_TOPICS_ID,
      entries,
      updatedAt: new Date().toISOString(),
    };
    await ddbDoc.send(new PutCommand({ TableName: CACHE_TABLE, Item: item }));
    console.log(`Wrote ${entries.length} seen topic fingerprints`);
  } catch (err) {
    console.warn('Failed to write seen topics:', err.message);
  }
}

// ============================================================
// ARCHIVE ENTRIES - the stories we follow and the repeat drop
// ============================================================

// The entries of the daily archive rows (`archive#YYYY-MM-DD`, written by the agent) of today and the `days` before, as
// {date, title, threadId, archivedAt}. Today is included, so a story moved by an earlier run today is listed. A day that cannot be read
// is left out and logged; the run goes on with what was read (decision 0057), at worst an empty list.
async function readArchiveEntries(days) {
  if (!CACHE_TABLE) return [];
  const now = Date.now();
  const dates = Array.from({ length: days + 1 }, (_, i) => new Date(now - i * 86400000).toISOString().slice(0, 10));
  const perDay = await Promise.all(dates.map(async (date) => {
    try {
      const result = await ddbDoc.send(new GetCommand({ TableName: CACHE_TABLE, Key: { id: `archive#${date}` } }));
      const entries = result?.Item?.entries;
      return (Array.isArray(entries) ? entries : []).filter((e) => e && e.title)
        .map((e) => ({ date, title: e.title, threadId: e.threadId || null, archivedAt: e.archivedAt || null }));
    } catch (err) {
      console.warn(`ARCHIVE: failed to read archive#${date}, left out of the stories we follow: ${err.message}`);
      return [];
    }
  }));
  const entries = perDay.flat();
  console.log(`ARCHIVE: ${entries.length} entries across ${dates.length} days`);
  return entries;
}

// ============================================================
// RSS FEED FETCHING - free, fast, no rate limits (the feed list is in selection.js)
// ============================================================

const { parseRssXml: parseRssCore } = require('./_shared/rss');
// Feed parsing lives in backend/shared/src/rss.js (also used by the recovery script); `Date.now()` is passed in so tests can fix the clock.
const parseRssXml = (xml, sourceName) => parseRssCore(xml, sourceName, Date.now());

async function fetchRssFeeds() {
  console.log(`Fetching ${RSS_FEEDS.length} RSS feeds in parallel...`);

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(feed.url, {
          headers: {
            'Accept': 'application/rss+xml, application/xml, text/xml',
            'User-Agent': 'GlobalPerspectives/1.0'
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`RSS ${feed.name} failed: HTTP ${response.status}`);
          return [];
        }

        const xml = await response.text();
        const articles = parseRssXml(xml, feed.source).slice(0, FEED_FETCH_CAP).map((a) => ({ ...a, feed: feed.name }));
        console.log(`RSS ${feed.name}: ${articles.length} articles`);
        return articles;
      } catch (err) {
        console.warn(`RSS ${feed.name} error: ${err.message}`);
        return [];
      }
    })
  );

  const allArticles = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Filter old articles
  const freshArticles = allArticles.filter(a => !shouldFilterArticle(a));
  console.log(`RSS total: ${freshArticles.length} fresh articles (filtered ${allArticles.length - freshArticles.length} old)`);
  return freshArticles;
}

// ============================================================
// NEWS FETCH — RSS only
// ============================================================
// Brave removed from ingest (S7 / plan §2.6, P0·T1 measurement): Brave was ~5.8% of the article
// pool, ~18% 429-rate-limited, and only 0.4% of chosen topics were sourced solely from Brave-only
// domains — RSS carries ingest with no meaningful loss and no fallback needed. The wire-service
// gap (reuters/apnews) it targeted was already near-zero yield (~0.38 articles/run). The five
// analysis-grounding Lambdas keep Brave; that is a separate provider follow-up.

async function fetchAllNews() {
  const rssArticles = await fetchRssFeeds();
  const uniqueArticles = dedupeByUrl(rssArticles);
  console.log(`COMBINED: ${uniqueArticles.length} unique articles (${rssArticles.length} RSS + 0 Brave; Brave removed S7)`);
  return uniqueArticles;
}

// ============================================================
// CACHE & UTILS
// ============================================================

function isScheduledEvent(event) {
  return (
    event?.source === 'aws.events' ||
    event?.detailType === 'Scheduled Event' ||
    event?.['detail-type'] === 'Scheduled Event'
  );
}

async function writeCache({ topics, model, limit }) {
  if (!CACHE_TABLE) {
    const reason = 'No TOPICS_DDB_TABLE env';
    console.log(`Skipping cache write: ${reason}`);
    return { cached: false, reason };
  }

  const now = new Date();
  const updatedAt = now.toISOString();
  const generationId = `gen-${Date.now()}`;
  const generatedDate = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const generatedYear = now.getFullYear();

  const item = {
    id: CACHE_ID,
    topics,
    model,
    limit,
    updatedAt,
    generatedDate,
    generatedYear,
    generationId,
    status: 'pending',
  };

  try {
    console.log(`DynamoDB write: table=${CACHE_TABLE}, id=${CACHE_ID}, generationId=${generationId}`);
    await ddbDoc.send(new PutCommand({ TableName: CACHE_TABLE, Item: item }));
    console.log(`DynamoDB write OK: generationId=${generationId}`);
    return { cached: true, updatedAt, generationId };
  } catch (e) {
    console.error('DynamoDB put error:', e);
    return { cached: false, reason: e.message };
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

// Log the cycle's input (every fetched article the selector saw) + output (chosen topics) to S3
// (audit/ingest-capture/, below; it replaced the GlobalPerspectiveIngestCapture DDB table, dropped).
// Fully fenced: any failure is swallowed so it can never break ingestion.
async function captureIngestion(inputArticles, chosenTopics, generationId) {
  try {
    const input = (inputArticles || []).slice(0, 300).map((a) => ({
      title: (a.title || '').slice(0, 200),
      source: a.source || '',
      url: a.url || '',
      age: a.age || '',
      snippet: (a.description || '').slice(0, 200),
    }));
    const chosen = (chosenTopics || []).map((t) => ({
      title: t.title || '',
      category: t.category || null,
      regions: t.regions || [],
      threadId: t.threadId || null,
      sourceUrls: (t.sources || []).map((s) => s.url).filter(Boolean),
    }));
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
    const runId = new Date().toISOString();
    const body = JSON.stringify({
      runId,
      generationId: generationId || null,
      inputCount: input.length,
      chosenCount: chosen.length,
      input,   // what the selector SAW (the audit basis for "missed high-impact?")
      chosen,  // what it CHOSE
    });
    // latest.json (its former reader newsImpactAudit was removed 2026-11-01) + a dated copy per run, so past runs can be replayed
    // (e.g. the Jev selection backtest). Path: <prefix>/YYYY-MM-DD/HHMM.json.
    const prefix = process.env.INGEST_CAPTURE_PREFIX || 'audit/ingest-capture';
    for (const Key of [`${prefix}/latest.json`, `${prefix}/${runId.slice(0, 10)}/${runId.slice(11, 16).replace(':', '')}.json`]) {
      await s3.send(new PutObjectCommand({
        Bucket: WORLD_BUCKET,
        Key,
        Body: body,
        ContentType: 'application/json',
      }));
    }
    console.log(`[capture] ${input.length} input articles -> ${chosen.length} chosen topics (S3)`);
  } catch (e) {
    console.warn('[capture] failed (non-fatal):', e.message);
  }
}

// The inbox writer over the real S3 client (tests inject their own into captureRawArticles).
function realS3Json() {
  const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
  return makeS3Json({
    client: new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' }),
    GetObjectCommand, PutObjectCommand, bucket: WORLD_BUCKET,
  });
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      const msg = 'Missing XAI_API_KEY environment variable';
      if (isScheduledEvent(event)) {
        throw new Error(msg);
      }
      return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) };
    }

    const qs = event?.queryStringParameters || {};
    const configuredLimit = parseInt(process.env.TOPICS_LIMIT || DEFAULT_LIMIT, 10) || DEFAULT_LIMIT;
    const limit = isScheduledEvent(event)
      ? Math.max(1, Math.min(20, configuredLimit))
      : Math.max(1, Math.min(20, parseInt(qs.limit || DEFAULT_LIMIT, 10) || DEFAULT_LIMIT));

    // Fetch news + read DynamoDB context in parallel
    const [allArticles, seenEntries, archiveEntries] = await Promise.all([
      fetchAllNews(),
      readSeenTopics(),
      readArchiveEntries(FOLLOWED_DAYS),
    ]);
    // RAW CAPTURE (0040 rule 1): everything fetched is stored before the model sees it. Fenced; never blocks the run.
    await captureRawArticles({
      articles: allArticles,
      now: new Date(),
      s3json: { appendLines: (...a) => realS3Json().appendLines(...a) },
      shadow: process.env.RAW_CAPTURE_SHADOW === '1',
    });

    console.log(`Seen topics from last 24h: ${seenEntries.length}`);
    // The stories we follow, numbered for this run: the prompt lists them and the answer's `follows` names one by number.
    const { stories } = followedStories(archiveEntries, Date.now());

    // One prompt row per event; the full pool stays for URL validation and source enrichment (selection.js).
    const { prompt } = selectionRequest({ articles: allArticles, limit, stories });

    console.log('Sending to the model, article count:', allArticles?.length || 0);

    // Shared llm.js (thinking off); the options are selection.js's, shared with the recovery script.
    const result = await chat(selectionChatOptions({ prompt, model: MODEL_NAME }));
    const text = result.content;

    console.log(
      'Model finish_reason:', result.finishReason,
      'chars:', text.length,
      'completion_tokens:', result.usage?.completion_tokens,
    );
    console.log('Model response preview:', text?.substring(0, 500));

    if (!text) {
      const msg = 'Empty response from the model';
      if (isScheduledEvent(event)) {
        throw new Error(msg);
      }
      return { statusCode: 502, headers, body: JSON.stringify({ error: msg }) };
    }

    // Parse, validate the source urls against the pool, enrich, filter, drop repeats of the last 24 h, cap (selection.js).
    const { topics: filtered } = processSelection({ text, articles: allArticles, seenEntries, archiveEntries, stories, limit, nowMs: Date.now(), env: process.env });

    const cacheResult = await writeCache({ topics: filtered, model: MODEL_NAME, limit });

    // Capture harness — fire-and-forget; fenced internally so it never affects ingestion.
    await captureIngestion(allArticles, filtered, cacheResult.generationId);

    // Update seen topics for soft dedup
    const mergedEntries = nextSeenEntries(seenEntries, filtered, Date.now());
    await writeSeenTopics(mergedEntries);

    if (isScheduledEvent(event)) {
      return {
        status: 'ok',
        count: filtered.length,
        cached: cacheResult.cached,
        updatedAt: cacheResult.updatedAt || null,
        articleCount: allArticles.length,
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        topics: filtered,
        ai_powered: true,
        model: MODEL_NAME,
        limit,
        cached: cacheResult.cached,
        updatedAt: cacheResult.updatedAt || null,
      }),
    };
  } catch (err) {
    console.error('Lambda error:', err);
    if (isScheduledEvent(event)) {
      // Fail the run: returning here reported success (Errors=0) and the agent marked the day processed.
      throw err;
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: err?.message || 'Unexpected error' }) };
  }
};

exports._internal = { normalizeSourceUrl, filterTopics, capTopics, extractJson, parseRssXml, canonicalIso3, RSS_FEEDS, buildSelectionPrompt };
