'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const GROK_MODEL = process.env.GROK_MODEL || 'grok-4-1-fast-non-reasoning';
const GROK_ENDPOINT = process.env.GROK_API_URL || 'https://api.x.ai/v1/chat/completions';
const GROK_KEY = process.env.XAI_API_KEY || '';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '3000', 10);
const TEMPERATURE = Number(process.env.TEMPERATURE || '0.3');

const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;

// Comma-separated list to restrict analysis to specific countries (Phase 1 testing)
const TEST_COUNTRIES = process.env.SYSTEMS_TEST_COUNTRIES
  ? process.env.SYSTEMS_TEST_COUNTRIES.split(',').map(s => s.trim()).filter(Boolean)
  : null;

const SYSTEMS_PK_PREFIX = 'SYSTEMS#';
const SYSTEMS_SK = 'SYSTEMS_ANALYSIS';
const THREAD_PK_PREFIX = 'THREAD#';
const THREAD_SK = 'THREAD_ANALYSIS';
const SYSTEMS_TTL_DAYS = 14;
const MAX_COUNTRIES = parseInt(process.env.SYSTEMS_TOP_N || '5', 10);
const ARCHIVE_DAYS = 30;
const MAX_THREADS_PER_COUNTRY = 15;
const MAX_EDGES_PER_NODE = 3;

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

// ─── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async () => {
  console.log('Systems analysis started');

  if (!TOPICS_TABLE || !SUMMARY_TABLE) {
    console.error('Missing table configuration');
    return { statusCode: 500, body: 'Missing table config' };
  }
  if (!GROK_KEY) {
    console.error('Missing XAI_API_KEY');
    return { statusCode: 500, body: 'Missing API key' };
  }

  const entries = await readArchiveEntries(ARCHIVE_DAYS);
  console.log(`Loaded ${entries.length} archive entries across ${ARCHIVE_DAYS} days`);

  const threadAnalyses = await loadThreadAnalyses(entries);
  console.log(`Loaded ${Object.keys(threadAnalyses).length} thread analyses`);

  const countries = groupByCountry(entries, threadAnalyses);
  console.log(`Found ${countries.length} eligible countries`);

  // Filter to test countries if set, otherwise take top N by article count
  const targets = TEST_COUNTRIES
    ? countries.filter(c => TEST_COUNTRIES.includes(c.countryName))
    : countries.slice(0, MAX_COUNTRIES);

  console.log(`Analyzing: ${targets.map(c => c.countryName).join(', ')}`);

  let generated = 0;
  let failed = 0;

  for (const country of targets) {
    try {
      const graph = await generateSystemsAnalysis(country);
      await writeAnalysis(country.countryName, graph, country);
      generated++;
      console.log(`Systems analysis done for ${country.countryName}: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
    } catch (err) {
      failed++;
      console.error(`Failed for ${country.countryName}:`, err.message);
    }
  }

  const summary = `Systems analysis complete: ${generated} generated, ${failed} failed`;
  console.log(summary);
  return { statusCode: 200, body: summary };
};

// ─── Data loading ─────────────────────────────────────────────────────────────

function formatDateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `archive#${y}-${m}-${d}`;
}

async function readArchiveEntries(days) {
  const entries = [];
  const now = new Date();

  for (let i = 0; i <= days; i++) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - i);
    const key = i === 0 ? 'today-archive' : formatDateKey(date);
    const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

    try {
      const { Item } = await ddb.send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: key } }));
      if (Item && Array.isArray(Item.entries)) {
        for (const e of Item.entries) {
          entries.push({
            topicId: e.topicId,
            threadId: e.threadId || null,
            title: e.title,
            date: dateStr,
            regions: e.regions || [],
            category: (e.category || 'other').toLowerCase(),
          });
        }
      }
    } catch (err) {
      console.warn(`Failed to read ${key}:`, err.message);
    }
  }

  return entries;
}

async function loadThreadAnalyses(entries) {
  const threadIds = [...new Set(entries.map(e => e.threadId).filter(Boolean))];
  const analyses = {};

  await Promise.all(threadIds.map(async (threadId) => {
    try {
      const { Item } = await ddb.send(new GetCommand({
        TableName: SUMMARY_TABLE,
        Key: { PK: `${THREAD_PK_PREFIX}${threadId}`, SK: THREAD_SK },
      }));
      if (Item) analyses[threadId] = Item;
    } catch {}
  }));

  return analyses;
}

// ─── Country grouping ─────────────────────────────────────────────────────────

function groupByCountry(entries, threadAnalyses) {
  const countryMap = {};

  for (const entry of entries) {
    for (const region of (entry.regions || [])) {
      if (!countryMap[region]) {
        countryMap[region] = { countryName: region, entries: [], threadIds: new Set() };
      }
      countryMap[region].entries.push(entry);
      if (entry.threadId) countryMap[region].threadIds.add(entry.threadId);
    }
  }

  return Object.values(countryMap)
    .filter(c => c.entries.length >= 4) // need enough for causal analysis
    .map(c => {
      const threadIds = [...c.threadIds];

      // Build thread nodes: threads with 2+ entries only
      const threads = threadIds
        .map(tid => {
          const threadEntries = c.entries.filter(e => e.threadId === tid);
          if (threadEntries.length < 2) return null;
          const analysis = threadAnalyses[tid] || null;

          // peakDate = date with most entries for this thread
          const dateCounts = {};
          for (const e of threadEntries) dateCounts[e.date] = (dateCounts[e.date] || 0) + 1;
          const peakDate = Object.entries(dateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || threadEntries[0].date;

          return {
            threadId: tid,
            category: threadEntries[0].category,
            peakDate,
            entryCount: threadEntries.length,
            title: analysis?.threadTitle || threadEntries[threadEntries.length - 1]?.title || 'Unknown',
            topicIds: threadEntries.map(e => e.topicId).filter(Boolean),
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.entryCount - a.entryCount)
        .slice(0, MAX_THREADS_PER_COUNTRY);

      // Collect all valid topicIds in scope for this country
      const allTopicIds = new Set(c.entries.map(e => e.topicId).filter(Boolean));

      return {
        countryName: c.countryName,
        totalArticles: c.entries.length,
        threads,
        allTopicIds: [...allTopicIds],
      };
    })
    .filter(c => c.threads.length >= 2) // need at least 2 threads for edges
    .sort((a, b) => b.totalArticles - a.totalArticles);
}

// ─── AI generation ────────────────────────────────────────────────────────────

function buildSystemsPrompt(country) {
  const validThreadIds = country.threads.map(t => t.threadId);
  const validTopicIds = new Set(country.allTopicIds);

  const threadList = country.threads.map((t, i) =>
    `[${i + 1}] threadId: "${t.threadId}"
     category: ${t.category}
     peakDate: ${t.peakDate}
     entryCount: ${t.entryCount}
     title: "${t.title}"
     topicIds: [${t.topicIds.slice(0, 5).map(id => `"${id}"`).join(', ')}]`
  ).join('\n\n');

  const todayStr = new Date().toISOString().slice(0, 10);

  return `You are analyzing causal relationships between news story threads in ${country.countryName} over the past 30 days (today: ${todayStr}).

You will receive a list of story threads. Your job: identify CAUSAL LINKS where one story plausibly caused, accelerated, or shaped another.

Think about second-order effects: economic shocks → social unrest → political change. Climate events → food prices → migration. Military escalation → economic sanctions → business disruption. These cross-category links are the most valuable to find.

=== STORY THREADS IN ${country.countryName.toUpperCase()} ===

${threadList}

=== END OF THREADS ===

HARD RULES — VIOLATIONS WILL BE REJECTED:
1. "nodes" must include ONLY threadIds listed above. Do not add, rename, or invent threadIds.
2. "edges.from" and "edges.to" must BOTH be threadIds from your nodes list.
3. "edges.citedEntries" must contain ONLY topicIds from the lists above. No invented IDs.
4. Every edge MUST have at least 1 cited entry. Edges without citations will be deleted.
5. Do NOT cite external knowledge. Every claim must trace back to the threads provided.
6. If you see no genuine causal relationship, return an empty edges array. That is better than inventing links.

CONFIDENCE LEVELS (use these exactly):
- "weak"   = plausible connection, inferential, less than 2 cited entries supporting it
- "medium" = named mechanism + at least 2 cited entries spanning at least 7 days
- "strong" = named mechanism + at least 3 cited entries + observable transmission (prices, protests, votes, statements)

CAUSAL DIRECTION: "from" = cause, "to" = effect. lagDays = days from cause's peakDate to effect's peakDate (can be negative if effect preceded cause in the archive, indicating reverse causation or co-movement). Must be between -90 and 90.

Return ONLY this JSON structure — no commentary, no markdown:

{
  "nodes": [
    {
      "threadId": "<exact threadId from above>",
      "category": "<category>",
      "peakDate": "<YYYY-MM-DD>",
      "summary": "<1 sentence describing the thread's core development>"
    }
  ],
  "edges": [
    {
      "from": "<threadId>",
      "to": "<threadId>",
      "lagDays": <integer -90 to 90>,
      "mechanism": "<1-2 sentences describing the transmission channel — be specific about actors, prices, or events>",
      "confidence": "weak|medium|strong",
      "citedEntries": ["<topicId>", ...]
    }
  ]
}`;
}

function validateGraph(parsed, country) {
  const validThreadIds = new Set(country.threads.map(t => t.threadId));
  const validTopicIds = new Set(country.allTopicIds);

  // Validate + filter nodes
  const nodes = (parsed.nodes || []).filter(n => {
    if (!validThreadIds.has(n.threadId)) {
      console.warn(`Dropping node with unknown threadId: ${n.threadId}`);
      return false;
    }
    return true;
  });
  const validNodeIds = new Set(nodes.map(n => n.threadId));

  // Validate + filter edges
  const edgesPerNode = {};
  const edges = (parsed.edges || []).filter(e => {
    if (!validNodeIds.has(e.from)) { console.warn(`Edge dropped: unknown from=${e.from}`); return false; }
    if (!validNodeIds.has(e.to))   { console.warn(`Edge dropped: unknown to=${e.to}`); return false; }
    if (e.from === e.to)           { console.warn(`Edge dropped: self-loop on ${e.from}`); return false; }

    // Filter citedEntries to only valid topicIds
    const validCited = (e.citedEntries || []).filter(id => {
      if (!validTopicIds.has(id)) { console.warn(`Dropping unknown citedEntry: ${id}`); return false; }
      return true;
    });
    if (validCited.length === 0) { console.warn(`Edge dropped: no valid citations for ${e.from}→${e.to}`); return false; }
    e.citedEntries = validCited;

    // Clamp lagDays
    e.lagDays = Math.max(-90, Math.min(90, parseInt(e.lagDays) || 0));

    // Downgrade confidence if citations don't meet the bar
    if (e.confidence === 'strong' && validCited.length < 3) e.confidence = 'medium';
    if (e.confidence === 'medium' && validCited.length < 2) e.confidence = 'weak';

    // Cap edges per source node
    edgesPerNode[e.from] = (edgesPerNode[e.from] || 0) + 1;
    if (edgesPerNode[e.from] > MAX_EDGES_PER_NODE) {
      console.warn(`Edge dropped: node ${e.from} exceeded max edges`);
      return false;
    }

    return true;
  });

  return { nodes, edges };
}

async function generateSystemsAnalysis(country) {
  const prompt = buildSystemsPrompt(country);
  const { content } = await invokeGrok(prompt);
  const cleaned = stripCodeFence(content);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse Grok response: ${err.message}\nRaw: ${cleaned.slice(0, 300)}`);
  }

  const graph = validateGraph(parsed, country);

  console.log(`  Raw: ${parsed.nodes?.length || 0} nodes, ${parsed.edges?.length || 0} edges → Valid: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  return graph;
}

// ─── Write to DynamoDB ────────────────────────────────────────────────────────

async function writeAnalysis(countryName, graph, country) {
  const ttl = Math.floor(Date.now() / 1000) + SYSTEMS_TTL_DAYS * 86400;

  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: {
      PK: `${SYSTEMS_PK_PREFIX}${countryName}`,
      SK: SYSTEMS_SK,
      countryName,
      nodes: graph.nodes,
      edges: graph.edges,
      totalArticles: country.totalArticles,
      threadCount: country.threads.length,
      generatedAt: new Date().toISOString(),
      model: GROK_MODEL,
      ttl,
    },
  }));
}

// ─── Grok API ─────────────────────────────────────────────────────────────────

async function invokeGrok(prompt) {
  const response = await fetch(GROK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROK_KEY}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages: [
        { role: 'system', content: 'You are a causal analysis engine. Return only valid JSON. No markdown, no commentary.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      response_format: { type: 'json_object' },
    }),
  });

  const rawText = await response.text();
  let parsed;
  try { parsed = JSON.parse(rawText); } catch { parsed = rawText; }

  if (!response.ok) {
    const message = parsed?.error?.message || rawText || `status ${response.status}`;
    throw new Error(`Grok API error: ${message}`);
  }

  const content = parsed?.choices?.[0]?.message?.content || '';
  return { content: stripCodeFence(content) };
}

function stripCodeFence(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
}
