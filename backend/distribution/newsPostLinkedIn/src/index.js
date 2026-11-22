'use strict';

const { generateTopicMapImage } = require('./mapImageGenerator');
const { storyCard, cardPng } = require('./storyCardPost');
const { forecastSentence } = require('./storyCardImage');
const { storyHref, absoluteUrl } = require('./_shared/links');
const { httpReply: response } = require('./_shared/httpReply');
const { CATEGORY_LABEL } = require('./_shared/categoryLabels');
const { readMode, readBy, SAME, lazyRecordReads } = require('./_shared/recordReads');
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

const MAX_POSTS_PER_RUN = parseInt(process.env.MAX_POSTS_PER_RUN || '5', 10);
const MAX_POSTS_PER_DAY = parseInt(process.env.MAX_POSTS_PER_DAY || '100', 10);

// RECORD_READS=ddb|record|compare (decision 0054): where the topic pool (NewsCache `latest`) comes from
const RECORD_READS = readMode();
const records = lazyRecordReads();

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

const SIGNIFICANCE_ORDER = { high: 0, medium: 1, low: 2 };

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

exports.handler = async (event) => {
  console.log('newsPostLinkedIn invoked', { event: JSON.stringify(event).substring(0, 200) });

  const aggregateResults = {};
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

    for (const platform of platforms) {
      try {
        const result = await runPlatform(platform, topics);
        aggregateResults[platform.name] = result;
      } catch (err) {
        console.error(`Platform ${platform.name} failed:`, err.message);
        aggregateResults[platform.name] = { status: 'error', error: err.message };
      }
    }

  } catch (err) {
    console.error('newsPostLinkedIn error:', err);
    return response(500, { status: 'error', error: err.message });
  }

  // A platform that attempted posts and landed none (expired token, API change) must not return
  // normally: throwing counts as a Lambda error, so the Lambda Errors metric counts it.
  // Partial success on a platform is a normal return.
  const allFailed = allPostsFailed(aggregateResults);
  if (allFailed.length) {
    console.error('Every attempted post failed on', allFailed.join(', '), JSON.stringify(aggregateResults));
    throw new Error(`Every attempted post failed on ${allFailed.join(', ')}`);
  }
  return response(200, { status: 'ok', platforms: aggregateResults });
};

// Names of platforms that attempted at least one post and posted none.
function allPostsFailed(aggregateResults) {
  return Object.entries(aggregateResults)
    .filter(([, r]) => r && r.attempted > 0 && r.posted === 0)
    .map(([name]) => name);
}

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
      postFn: async (text, imageBuffer) => postToLinkedIn(LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_ID, text, imageBuffer),
      needsSummary: true,
      supportsImage: true,
    });
  }

  if (BLUESKY_IDENTIFIER && BLUESKY_APP_PASSWORD) {
    platforms.push({
      name: 'BLUESKY',
      maxPerRun: MAX_POSTS_PER_RUN,
      maxPerDay: MAX_POSTS_PER_DAY,
      formatFn: (topic, summary, forecast) => formatShortPost(topic, 300, forecast),
      postFn: async (text, imageBuffer, topic) => postToBluesky(BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD, text, imageBuffer, [postLink(topic)]),
      needsSummary: false,
      supportsImage: true,
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
      // The story card: the picture, and our forecast (the story's) in the text.
      const card = await cardOf(name, topic);
      const forecast = forecastSentence(card?.forecast);
      const summary = needsSummary ? await readSummaryContent(topic.id || topic.topicId, 'SUMMARY') : '';
      const postText = formatFn(topic, summary, forecast);

      let imageBuffer = null;
      if (platform.supportsImage) imageBuffer = await postImage(name, topic, card);

      console.log(`[${name}] Posting: "${topic.title.substring(0, 50)}..." (${postText.length} chars${imageBuffer ? ' + image' : ''})`);

      const postResult = await postFn(postText, imageBuffer, topic);

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

/** The story card data of a topic in a story (storyCardPost), with the topic's title as its headline; null without one or on failure. */
async function cardOf(name, topic) {
  if (!topic.threadId) return null;
  try {
    return await storyCard(topic.threadId, { siteUrl: SITE_URL, headline: topic.title });
  } catch (err) {
    console.warn(`[${name}] Story card data failed, using the map:`, err.message);
    return null;
  }
}

/** The post picture: the story card; without one, or when drawing it fails, the old map; null posts text-only. */
async function postImage(name, topic, card) {
  if (card) {
    try {
      const png = await cardPng(card);
      console.log(`[${name}] Story card generated (${Math.round(png.length / 1024)}KB)`);
      return png;
    } catch (err) {
      console.warn(`[${name}] Story card failed, using the map:`, err.message);
    }
  }
  try {
    const map = await generateTopicMapImage(topic);
    if (map) console.log(`[${name}] Map image generated (${Math.round(map.length / 1024)}KB)`);
    return map;
  } catch (err) {
    console.warn(`[${name}] Map image failed, posting text-only:`, err.message);
    return null;
  }
}

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
  const Item = await readBy({
    mode: RECORD_READS, label: 'linkedin latest', same: SAME.latest,
    ddb: async () => (await ddb.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: 'latest' } }))).Item,
    record: () => records.latestItem(),
  });

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
    threadId: t.threadId || null,
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
  // LinkedIn 2026 best practice: 3–5 hashtags max (>5 measurably hurts reach), at the end.
  const tags = (topic.regions || [])
    .slice(0, 2)
    .map(r => `#${r.replace(/[^a-zA-Z0-9]/g, '')}`)
    .filter(t => t.length > 1);

  if (topic.category) tags.push(`#${topic.category}`);
  tags.push('#GlobalPerspectives');
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

function formatLinkedInPost(topic, summary, forecast) {
  const category = CATEGORY_LABEL[topic.category] || 'World';
  const MAX_CHARS = 3000;

  const header = `[${category}] ${topic.title}\n\n`;

  // Deep-link to the specific story's page (not the homepage).
  const link = topic.threadId ? absoluteUrl(storyHref(topic.threadId), SITE_URL) : SITE_URL;
  const footer = `\nRead full analysis: ${link}\n\n` +
    buildHashtags(topic);

  const reservedChars = header.length + footer.length + 20;
  const availableChars = MAX_CHARS - reservedChars;

  // Our forecast (one sentence, from the story) follows the summary.
  const tail = forecast ? `\n\n${forecast}` : '';
  const cleanSummary = summary ? stripMarkdown(summary) : '';
  const body = (cleanSummary ? truncateAtSentence(cleanSummary, availableChars - tail.length) : '') + tail;

  let post = `${header}${body}\n${footer}`.trim();

  if (post.length > MAX_CHARS) {
    post = post.substring(0, MAX_CHARS - 3) + '...';
  }

  return post;
}

/** The link of a post: the story's page (else the site), shown as the site's bare name; Bluesky makes the name a link (a facet). */
function postLink(topic) {
  const uri = topic.threadId ? absoluteUrl(storyHref(topic.threadId), SITE_URL) : SITE_URL;
  return { uri, display: new URL(SITE_URL).host };
}

/** A short post (Bluesky, 300 characters): [Category] title, our forecast, the link (postLink's short name), hashtags. Over the limit
 *  the forecast's words are cut first, then the forecast goes, then the title is cut. */
function formatShortPost(topic, maxLen, forecast = '') {
  const category = CATEGORY_LABEL[topic.category] || 'World';
  const tail = `\n\n${postLink(topic).display}\n\n${buildHashtags(topic)}`;
  const len = (t) => [...t].length;
  const head = `[${category}] ${topic.title}`;
  const room = maxLen - len(head) - len(tail) - 2; // room for "\n\n" + forecast
  if (forecast && len(forecast) <= room) return `${head}\n\n${forecast}${tail}`;
  if (forecast && room >= 40) return `${head}\n\n${cutAtWord(forecast, room)}${tail}`;
  if (len(head) + len(tail) <= maxLen) return `${head}${tail}`;
  return `${cutAtWord(head, maxLen - len(tail))}${tail}`;
}

/** Cut text to at most max characters at a word break, ending in '…'. */
function cutAtWord(text, max) {
  const chars = [...text];
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max - 1).join('');
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max / 2 ? cut.slice(0, sp) : cut).replace(/[\s,;:]+$/, '')}…`;
}

// ---------------------------------------------------------------------------
// Platform poster: LinkedIn
// ---------------------------------------------------------------------------

async function uploadLinkedInImage(accessToken, personId, imageBuffer) {
  // Step 1: Initialize upload
  const initRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Linkedin-Version': LINKEDIN_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: `urn:li:person:${personId}`,
      },
    }),
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`LinkedIn image init error ${initRes.status}: ${errText}`);
  }

  const initData = await initRes.json();
  const uploadUrl = initData.value?.uploadUrl;
  const imageUrn = initData.value?.image;

  if (!uploadUrl || !imageUrn) {
    throw new Error('LinkedIn image init: missing uploadUrl or image URN');
  }

  // Step 2: Upload binary
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'image/png',
    },
    body: imageBuffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`LinkedIn image upload error ${uploadRes.status}: ${errText}`);
  }

  return imageUrn;
}

async function postToLinkedIn(accessToken, personId, commentary, imageBuffer) {
  // Upload image if provided
  let imageUrn = null;
  if (imageBuffer) {
    try {
      imageUrn = await uploadLinkedInImage(accessToken, personId, imageBuffer);
      console.log(`[LINKEDIN] Image uploaded: ${imageUrn}`);
    } catch (imgErr) {
      console.warn(`[LINKEDIN] Image upload failed, posting text-only:`, imgErr.message);
    }
  }

  const postBody = {
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
  };

  // Attach image if uploaded
  if (imageUrn) {
    postBody.content = {
      media: {
        id: imageUrn,
        title: 'Global Perspectives Map',
      },
    };
  }

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Linkedin-Version': LINKEDIN_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(postBody),
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

/** Bluesky shows a link only through a facet: the UTF-8 byte range of the link's shown text (its last place in the post) and its address. */
function linkFacets(text, links) {
  const out = [];
  for (const { display, uri } of links || []) {
    const at = text.lastIndexOf(display);
    if (at < 0) continue;
    const byteStart = Buffer.byteLength(text.slice(0, at), 'utf8');
    out.push({ index: { byteStart, byteEnd: byteStart + Buffer.byteLength(display, 'utf8') }, features: [{ $type: 'app.bsky.richtext.facet#link', uri }] });
  }
  return out;
}

async function postToBluesky(identifier, appPassword, text, imageBuffer, links = []) {
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

  // Step 2: Upload image if provided
  let embed = undefined;
  if (imageBuffer) {
    try {
      const blobRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessJwt}`,
          'Content-Type': 'image/png',
        },
        body: imageBuffer,
      });

      if (blobRes.ok) {
        const blobData = await blobRes.json();
        embed = {
          $type: 'app.bsky.embed.images',
          images: [{
            alt: text.substring(0, 300),
            image: blobData.blob,
          }],
        };
        console.log('[BLUESKY] Image uploaded successfully');
      } else {
        console.warn(`[BLUESKY] Image upload failed: ${blobRes.status}, posting text-only`);
      }
    } catch (imgErr) {
      console.warn('[BLUESKY] Image upload error, posting text-only:', imgErr.message);
    }
  }

  // Step 3: Create post record
  const now = new Date().toISOString();
  const record = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: now,
  };
  if (embed) record.embed = embed;
  const facets = linkFacets(text, links);
  if (facets.length) record.facets = facets;

  const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.post',
      record,
    }),
  });

  if (!postRes.ok) {
    const errText = await postRes.text();
    throw new Error(`Bluesky post error ${postRes.status}: ${errText}`);
  }

  const result = await postRes.json();
  return { success: true, postId: result.uri || null };
}


exports.loadLatestTopics = loadLatestTopics; // for tests
