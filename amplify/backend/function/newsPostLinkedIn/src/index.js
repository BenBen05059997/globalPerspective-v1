'use strict';

const crypto = require('crypto');
const WebSocket = require('ws');
const nostrTools = require('nostr-tools');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  BatchGetCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const POSTS_TABLE = process.env.SOCIAL_POSTS_TABLE || process.env.LINKEDIN_POSTS_TABLE;
const SITE_URL = process.env.SITE_URL || 'https://globalperspective.net/';
const PK_PREFIX = process.env.SUMMARY_PREDICT_PK_PREFIX || 'TOPIC#';
const POST_TTL_DAYS = 30;

// LinkedIn
const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN || '';
const LINKEDIN_PERSON_ID = process.env.LINKEDIN_PERSON_ID || '';
const LINKEDIN_API_VERSION = '202601';

// Bluesky
const BLUESKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER || '';
const BLUESKY_APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD || '';

// X / Twitter — disabled
// const X_API_KEY = process.env.X_API_KEY || '';

// Threads — disabled
// const THREADS_ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN || '';

// Farcaster (via Neynar)
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '';
const FARCASTER_SIGNER_UUID = process.env.FARCASTER_SIGNER_UUID || '';

// Mastodon
const MASTODON_ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN || '';
const MASTODON_INSTANCE = process.env.MASTODON_INSTANCE || 'mastodon.social';

// Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '';

// Nostr
const NOSTR_PRIVATE_KEY_NSEC = process.env.NOSTR_PRIVATE_KEY_NSEC || '';

const MAX_POSTS_PER_RUN = parseInt(process.env.MAX_POSTS_PER_RUN || '5', 10);
const MAX_POSTS_PER_DAY = parseInt(process.env.MAX_POSTS_PER_DAY || '100', 10);

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

const CATEGORY_LABEL = {
  politics: 'Politics',
  economy: 'Economy',
  military: 'Military',
  conflict: 'Conflict',
  disaster: 'Disaster',
  technology: 'Technology',
  health: 'Health',
};

const SIGNIFICANCE_ORDER = { high: 0, medium: 1, low: 2 };

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

exports.handler = async (event) => {
  console.log('newsPostLinkedIn invoked', { event: JSON.stringify(event).substring(0, 200) });

  try {
    if (!TOPICS_TABLE || !SUMMARY_TABLE || !POSTS_TABLE) {
      const missing = [];
      if (!TOPICS_TABLE) missing.push('TOPICS_DDB_TABLE');
      if (!SUMMARY_TABLE) missing.push('SUMMARIZE_PREDICT_TABLE');
      if (!POSTS_TABLE) missing.push('SOCIAL_POSTS_TABLE / LINKEDIN_POSTS_TABLE');
      throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    }

    const platforms = buildPlatformList();

    if (!platforms.length) {
      console.log('No platforms configured, skipping');
      return response(200, { status: 'skipped', reason: 'no platforms configured' });
    }

    console.log(`Active platforms: ${platforms.map(p => p.name).join(', ')}`);

    const topics = await loadLatestTopics();
    if (!topics.length) {
      console.log('No topics available, skipping');
      return response(200, { status: 'skipped', reason: 'no topics' });
    }

    const aggregateResults = {};

    for (const platform of platforms) {
      try {
        const result = await runPlatform(platform, topics);
        aggregateResults[platform.name] = result;
      } catch (err) {
        console.error(`Platform ${platform.name} failed:`, err.message);
        aggregateResults[platform.name] = { status: 'error', error: err.message };
      }
    }

    return response(200, { status: 'ok', platforms: aggregateResults });
  } catch (err) {
    console.error('newsPostLinkedIn error:', err);
    return response(500, { status: 'error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// Platform configuration
// ---------------------------------------------------------------------------

function buildPlatformList() {
  const platforms = [];

  if (LINKEDIN_ACCESS_TOKEN && LINKEDIN_PERSON_ID) {
    platforms.push({
      name: 'LINKEDIN',
      maxPerRun: MAX_POSTS_PER_RUN,
      maxPerDay: MAX_POSTS_PER_DAY,
      formatFn: formatLinkedInPost,
      postFn: async (text) => postToLinkedIn(LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_ID, text),
      needsSummary: true,
    });
  }

  if (BLUESKY_IDENTIFIER && BLUESKY_APP_PASSWORD) {
    platforms.push({
      name: 'BLUESKY',
      maxPerRun: MAX_POSTS_PER_RUN,
      maxPerDay: MAX_POSTS_PER_DAY,
      formatFn: (topic) => formatShortPost(topic, 300),
      postFn: async (text) => postToBluesky(BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD, text),
      needsSummary: false,
    });
  }

  if (MASTODON_ACCESS_TOKEN) {
    platforms.push({
      name: 'MASTODON',
      maxPerRun: MAX_POSTS_PER_RUN,
      maxPerDay: MAX_POSTS_PER_DAY,
      formatFn: (topic) => formatShortPost(topic, 500),
      postFn: async (text) => postToMastodon(MASTODON_ACCESS_TOKEN, MASTODON_INSTANCE, text),
      needsSummary: false,
    });
  }

  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHANNEL_ID) {
    platforms.push({
      name: 'TELEGRAM',
      maxPerRun: MAX_POSTS_PER_RUN,
      maxPerDay: MAX_POSTS_PER_DAY,
      formatFn: (topic) => formatShortPost(topic, 4096),
      postFn: async (text) => postToTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID, text),
      needsSummary: false,
    });
  }

  if (NOSTR_PRIVATE_KEY_NSEC) {
    platforms.push({
      name: 'NOSTR',
      maxPerRun: MAX_POSTS_PER_RUN,
      maxPerDay: MAX_POSTS_PER_DAY,
      formatFn: (topic) => formatShortPost(topic, 800),
      postFn: async (text) => postToNostr(NOSTR_PRIVATE_KEY_NSEC, text),
      needsSummary: false,
    });
  }

  if (NEYNAR_API_KEY && FARCASTER_SIGNER_UUID) {
    platforms.push({
      name: 'FARCASTER',
      maxPerRun: MAX_POSTS_PER_RUN,
      maxPerDay: MAX_POSTS_PER_DAY,
      formatFn: (topic) => formatShortPost(topic, 320),
      postFn: async (text) => postToFarcaster(NEYNAR_API_KEY, FARCASTER_SIGNER_UUID, text),
      needsSummary: false,
    });
  }

  return platforms;
}

// ---------------------------------------------------------------------------
// Per-platform run loop
// ---------------------------------------------------------------------------

async function runPlatform(platform, allTopics) {
  const { name, maxPerRun, maxPerDay, formatFn, postFn, needsSummary } = platform;

  console.log(`[${name}] Starting — ${allTopics.length} topics available`);

  const fingerprints = allTopics.map(t => ({
    topic: t,
    fingerprint: titleFingerprint(t.title),
  }));

  const alreadyPosted = await getAlreadyPostedFingerprintsForPlatform(
    name, fingerprints.map(f => f.fingerprint)
  );

  const newTopics = fingerprints.filter(f => !alreadyPosted.has(f.fingerprint));
  console.log(`[${name}] ${newTopics.length} new topics (${alreadyPosted.size} already posted)`);

  if (!newTopics.length) {
    return { status: 'skipped', reason: 'no new topics' };
  }

  const dailyCount = await getDailyPostCountForPlatform(name);
  if (dailyCount >= maxPerDay) {
    console.warn(`[${name}] Daily limit reached (${dailyCount}/${maxPerDay})`);
    return { status: 'skipped', reason: 'daily limit reached', dailyCount };
  }

  const remainingSlots = Math.min(maxPerRun, maxPerDay - dailyCount);

  const sorted = newTopics.sort((a, b) => {
    const sigA = SIGNIFICANCE_ORDER[a.topic.significance] ?? 1;
    const sigB = SIGNIFICANCE_ORDER[b.topic.significance] ?? 1;
    return sigA - sigB;
  });

  const toPost = sorted.slice(0, remainingSlots);
  const results = [];

  for (const { topic, fingerprint } of toPost) {
    try {
      let postText;

      if (needsSummary) {
        const [summary, prediction] = await Promise.all([
          readSummaryContent(topic.id || topic.topicId, 'SUMMARY'),
          readSummaryContent(topic.id || topic.topicId, 'PREDICTION'),
        ]);
        postText = formatFn(topic, summary, prediction);
      } else {
        postText = formatFn(topic);
      }

      console.log(`[${name}] Posting: "${topic.title.substring(0, 50)}..." (${postText.length} chars)`);

      const postResult = await postFn(postText);

      await recordPostedTopicForPlatform(name, fingerprint, topic, postResult.postUrn || postResult.postId || null);

      results.push({
        title: topic.title,
        fingerprint,
        postId: postResult.postUrn || postResult.postId || null,
        chars: postText.length,
      });

      console.log(`[${name}] Posted successfully: "${topic.title.substring(0, 50)}..."`);
    } catch (postErr) {
      console.error(`[${name}] Failed to post "${topic.title.substring(0, 50)}...":`, postErr.message);

      if (postErr.message.includes('401') || postErr.message.includes('Unauthorized') || postErr.message.includes('403')) {
        console.error(`[${name}] Auth failed, stopping further posts`);
        break;
      }
      if (postErr.message.includes('429') || postErr.message.includes('rate')) {
        console.warn(`[${name}] Rate limited, stopping further posts`);
        break;
      }
    }
  }

  console.log(`[${name}] Complete: ${results.length}/${toPost.length} succeeded`);

  return { status: 'ok', posted: results.length, attempted: toPost.length, results };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function titleFingerprint(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);
}

async function loadLatestTopics() {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TOPICS_TABLE,
      Key: { id: 'latest' },
    })
  );

  if (!Item || !Array.isArray(Item.topics)) {
    return [];
  }

  return Item.topics.map((t, idx) => ({
    id: t.id || t.topicId || `topic-${idx}`,
    topicId: t.topicId || t.id || `topic-${idx}`,
    title: t.title || '',
    category: (Array.isArray(t.categories) && t.categories[0]) || t.category || '',
    regions: Array.isArray(t.regions) ? t.regions : [],
    significance: t.significance || 'medium',
    sources: t.sources || [],
  }));
}

async function readSummaryContent(topicId, sk) {
  try {
    const { Item } = await ddb.send(
      new GetCommand({
        TableName: SUMMARY_TABLE,
        Key: { PK: `${PK_PREFIX}${topicId}`, SK: sk },
      })
    );
    return Item?.content || '';
  } catch (err) {
    console.warn(`Failed to read ${sk} for ${topicId}:`, err.message);
    return '';
  }
}

function stripMarkdown(text) {
  return text
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/Watchlist Signals[\s\S]*/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncateAtSentence(text, maxLen) {
  if (text.length <= maxLen) return text;
  const truncated = text.substring(0, maxLen);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint = Math.max(lastPeriod, lastNewline);
  if (cutPoint > maxLen * 0.5) {
    return truncated.substring(0, cutPoint + 1).trim();
  }
  return truncated.trim() + '...';
}

function buildHashtags(topic) {
  const tags = (topic.regions || [])
    .slice(0, 3)
    .map(r => `#${r.replace(/[^a-zA-Z0-9]/g, '')}`)
    .filter(t => t.length > 1);

  if (topic.category) tags.push(`#${topic.category}`);
  tags.push('#GlobalPerspectives', '#WorldNews');
  return tags.join(' ');
}

// ---------------------------------------------------------------------------
// Per-platform dedup
// ---------------------------------------------------------------------------

async function getAlreadyPostedFingerprintsForPlatform(platform, fingerprints) {
  const posted = new Set();
  if (!fingerprints.length) return posted;

  const batches = [];
  for (let i = 0; i < fingerprints.length; i += 100) {
    batches.push(fingerprints.slice(i, i + 100));
  }

  for (const batch of batches) {
    try {
      const keys = batch.map(fp => ({ PK: `POSTED#${platform}#${fp}` }));

      // LinkedIn backward compat: also check legacy PK format
      if (platform === 'LINKEDIN') {
        batch.forEach(fp => keys.push({ PK: `POSTED#${fp}` }));
      }

      // DynamoDB BatchGetItem max 100 keys per table
      const keyBatches = [];
      for (let j = 0; j < keys.length; j += 100) {
        keyBatches.push(keys.slice(j, j + 100));
      }

      for (const keyBatch of keyBatches) {
        const { Responses } = await ddb.send(
          new BatchGetCommand({
            RequestItems: {
              [POSTS_TABLE]: { Keys: keyBatch },
            },
          })
        );
        (Responses?.[POSTS_TABLE] || []).forEach(item => {
          // Extract fingerprint from either format
          const pk = item.PK;
          let fp;
          if (pk.startsWith(`POSTED#${platform}#`)) {
            fp = pk.replace(`POSTED#${platform}#`, '');
          } else if (pk.startsWith('POSTED#')) {
            fp = pk.replace('POSTED#', '');
          }
          if (fp) posted.add(fp);
        });
      }
    } catch (err) {
      console.error(`[${platform}] BatchGet error for posted topics:`, err.message);
    }
  }

  return posted;
}

async function getDailyPostCountForPlatform(platform) {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { Items } = await ddb.send(
      new ScanCommand({
        TableName: POSTS_TABLE,
        FilterExpression: 'begins_with(PK, :prefix) AND postedAt > :since',
        ExpressionAttributeValues: {
          ':prefix': `POSTED#${platform}#`,
          ':since': oneDayAgo,
        },
        ProjectionExpression: 'PK',
      })
    );
    return Items?.length || 0;
  } catch (err) {
    console.warn(`[${platform}] Failed to get daily post count:`, err.message);
    return 0;
  }
}

async function recordPostedTopicForPlatform(platform, fingerprint, topic, postId) {
  const ttl = Math.floor(Date.now() / 1000) + POST_TTL_DAYS * 24 * 60 * 60;

  try {
    await ddb.send(
      new PutCommand({
        TableName: POSTS_TABLE,
        Item: {
          PK: `POSTED#${platform}#${fingerprint}`,
          platform,
          topicTitle: topic.title,
          topicId: topic.id || topic.topicId,
          postId: postId || null,
          postedAt: new Date().toISOString(),
          ttl,
        },
      })
    );
  } catch (err) {
    console.error(`[${platform}] Failed to record posted topic:`, err.message);
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatLinkedInPost(topic, summary, prediction) {
  const category = CATEGORY_LABEL[topic.category] || 'World';
  const MAX_CHARS = 3000;

  const header = `[${category}] ${topic.title}\n\n`;

  const footer = `\nRead full analysis: ${SITE_URL}\n\n` +
    buildHashtags(topic) + ' #AI';

  const reservedChars = header.length + footer.length + 20;
  const availableChars = MAX_CHARS - reservedChars;

  let cleanSummary = summary ? stripMarkdown(summary) : '';
  let cleanPrediction = prediction ? stripMarkdown(prediction) : '';

  let body = '';

  if (cleanSummary && cleanPrediction) {
    const summaryBudget = Math.floor(availableChars * 0.45);
    const predictionBudget = Math.floor(availableChars * 0.50);

    const trimmedSummary = truncateAtSentence(cleanSummary, summaryBudget);
    const trimmedPrediction = truncateAtSentence(cleanPrediction, predictionBudget);

    body = `${trimmedSummary}\n\n---\nPrediction:\n\n${trimmedPrediction}`;
  } else if (cleanSummary) {
    body = truncateAtSentence(cleanSummary, availableChars);
  } else if (cleanPrediction) {
    body = `Prediction:\n\n${truncateAtSentence(cleanPrediction, availableChars)}`;
  }

  let post = `${header}${body}\n${footer}`.trim();

  if (post.length > MAX_CHARS) {
    post = post.substring(0, MAX_CHARS - 3) + '...';
  }

  return post;
}

function formatShortPost(topic, maxLen) {
  const category = CATEGORY_LABEL[topic.category] || 'World';
  const hashtags = buildHashtags(topic);
  const link = SITE_URL;

  // Build: [Category] Title\n\nlink\n\nhashtags
  const base = `[${category}] ${topic.title}\n\n${link}\n\n${hashtags}`;

  if (base.length <= maxLen) return base;

  // Trim title if needed
  const overhead = `[${category}] `.length + `\n\n${link}\n\n${hashtags}`.length + 3;
  const titleBudget = maxLen - overhead;
  const trimmedTitle = topic.title.substring(0, titleBudget) + '...';

  return `[${category}] ${trimmedTitle}\n\n${link}\n\n${hashtags}`;
}

function formatThreadsPost(topic, summary) {
  const category = CATEGORY_LABEL[topic.category] || 'World';
  const MAX_CHARS = 500;
  const hashtags = buildHashtags(topic);
  const link = SITE_URL;

  const header = `[${category}] ${topic.title}\n\n`;
  const footer = `\n\n${link}\n\n${hashtags}`;

  const reservedChars = header.length + footer.length;
  const availableChars = MAX_CHARS - reservedChars;

  let body = '';
  if (summary && availableChars > 30) {
    const cleanSummary = stripMarkdown(summary);
    body = truncateAtSentence(cleanSummary, availableChars);
  }

  let post = `${header}${body}${footer}`.trim();

  if (post.length > MAX_CHARS) {
    post = post.substring(0, MAX_CHARS - 3) + '...';
  }

  return post;
}

// ---------------------------------------------------------------------------
// Platform poster: LinkedIn
// ---------------------------------------------------------------------------

async function postToLinkedIn(accessToken, personId, commentary) {
  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Linkedin-Version': LINKEDIN_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      author: `urn:li:person:${personId}`,
      commentary,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`LinkedIn API error ${res.status}: ${errorText}`);
  }

  const postUrn = res.headers.get('x-restli-id') || null;
  return { success: true, postUrn };
}

// ---------------------------------------------------------------------------
// Platform poster: Bluesky (AT Protocol)
// ---------------------------------------------------------------------------

async function postToBluesky(identifier, appPassword, text) {
  // Step 1: Create session (login)
  const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: appPassword }),
  });

  if (!sessionRes.ok) {
    const errText = await sessionRes.text();
    throw new Error(`Bluesky auth error ${sessionRes.status}: ${errText}`);
  }

  const session = await sessionRes.json();
  const { accessJwt, did } = session;

  // Step 2: Create post record
  const now = new Date().toISOString();
  const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: now,
      },
    }),
  });

  if (!postRes.ok) {
    const errText = await postRes.text();
    throw new Error(`Bluesky post error ${postRes.status}: ${errText}`);
  }

  const result = await postRes.json();
  return { success: true, postId: result.uri || null };
}

// ---------------------------------------------------------------------------
// Platform poster: X / Twitter (OAuth 1.0a)
// ---------------------------------------------------------------------------

async function postToX(apiKey, apiSecret, accessToken, accessTokenSecret, text) {
  const url = 'https://api.x.com/2/tweets';
  const method = 'POST';

  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  // Build signature base string
  const paramString = Object.keys(oauthParams)
    .sort()
    .map(k => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join('&');

  const signatureBaseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join('&');

  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessTokenSecret)}`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  oauthParams.oauth_signature = signature;

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(k => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(', ');

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`X API error ${res.status}: ${errText}`);
  }

  const result = await res.json();
  return { success: true, postId: result.data?.id || null };
}

function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

// ---------------------------------------------------------------------------
// Platform poster: Threads (Meta Graph API)
// ---------------------------------------------------------------------------

async function postToThreads(accessToken, userId, text) {
  // Step 1: Create media container
  const createUrl = `https://graph.threads.net/v1.0/${userId}/threads?` +
    `media_type=TEXT&text=${encodeURIComponent(text)}&access_token=${accessToken}`;

  const createRes = await fetch(createUrl, { method: 'POST' });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Threads create error ${createRes.status}: ${errText}`);
  }

  const { id: creationId } = await createRes.json();

  // Step 2: Wait for container to be ready
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Step 3: Publish
  const publishUrl = `https://graph.threads.net/v1.0/${userId}/threads_publish?` +
    `creation_id=${creationId}&access_token=${accessToken}`;

  const publishRes = await fetch(publishUrl, { method: 'POST' });

  if (!publishRes.ok) {
    const errText = await publishRes.text();
    throw new Error(`Threads publish error ${publishRes.status}: ${errText}`);
  }

  const result = await publishRes.json();
  return { success: true, postId: result.id || null };
}

// ---------------------------------------------------------------------------
// Platform poster: Nostr
// ---------------------------------------------------------------------------

const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

async function postToNostr(nsec, text) {
  const { data: privkeyBytes } = nostrTools.nip19.decode(nsec);
  const privkeyHex = Buffer.from(privkeyBytes).toString('hex');
  const pubkeyHex = nostrTools.getPublicKey(privkeyHex);

  const event = {
    kind: 1,
    pubkey: pubkeyHex,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: text,
  };
  event.id = nostrTools.getEventHash(event);
  event.sig = nostrTools.signEvent(event, privkeyHex);

  // Publish to relays in parallel, succeed if at least one accepts
  const results = await Promise.allSettled(
    NOSTR_RELAYS.map(relay => publishToNostrRelay(relay, event))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled');
  if (!succeeded.length) {
    throw new Error('All Nostr relays rejected the event');
  }

  return { success: true, postId: event.id };
}

function publishToNostrRelay(relayUrl, event) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(relayUrl);
    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error(`${relayUrl} timed out`));
    }, 8000);

    ws.on('open', () => {
      ws.send(JSON.stringify(['EVENT', event]));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg[0] === 'OK') {
          clearTimeout(timeout);
          ws.close();
          resolve(msg);
        }
      } catch (_) {}
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Platform poster: Telegram
// ---------------------------------------------------------------------------

async function postToTelegram(botToken, channelId, text) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: channelId, text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${errText}`);
  }

  const result = await res.json();
  return { success: true, postId: result.result?.message_id?.toString() || null };
}

// ---------------------------------------------------------------------------
// Platform poster: Mastodon
// ---------------------------------------------------------------------------

async function postToMastodon(accessToken, instance, status) {
  const res = await fetch(`https://${instance}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Mastodon API error ${res.status}: ${errText}`);
  }

  const result = await res.json();
  return { success: true, postId: result.id || null };
}

// ---------------------------------------------------------------------------
// Platform poster: Farcaster (via Neynar)
// ---------------------------------------------------------------------------

async function postToFarcaster(apiKey, signerUuid, text) {
  const res = await fetch('https://api.neynar.com/v2/farcaster/cast', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ signer_uuid: signerUuid, text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Farcaster API error ${res.status}: ${errText}`);
  }

  const result = await res.json();
  return { success: true, postId: result.cast?.hash || null };
}

// ---------------------------------------------------------------------------
// Response helper
// ---------------------------------------------------------------------------

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
