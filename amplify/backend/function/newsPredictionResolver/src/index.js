'use strict';

// newsPredictionResolver — daily pass over logged prediction snapshots.
// For every dated trigger that has come due (deadline <= today) and has no
// verdict yet, it grounds the question in fresh Brave Search results and asks
// the LLM to PROPOSE fired/not_fired/unclear + a citation. It never finalizes:
// the proposal awaits human confirmation via scripts/predictions/review.js
// (hybrid resolution). Scoring is computed on-read by the proxy track-record
// action, so this Lambda only writes proposals.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const LOG_TABLE = process.env.PREDICTION_LOG_TABLE || 'GlobalPerspectivePredictionLog';
const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';
const BRAVE_NEWS_ENDPOINT = 'https://api.search.brave.com/res/v1/news/search';
const BRAVE_WEB_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

// LLM config reuses the GROK_*/XAI_API_KEY env-var names the rest of the repo
// uses; in production they hold DeepSeek values (see ARCHITECTURE.md note).
const LLM_KEY = process.env.XAI_API_KEY || '';
const LLM_ENDPOINT = process.env.GROK_API_URL || 'https://api.deepseek.com/chat/completions';
const LLM_MODEL = process.env.GROK_MODEL || 'deepseek-chat';

const MAX_RESOLVE_PER_RUN = parseInt(process.env.MAX_RESOLVE_PER_RUN || '40', 10);
const LLM_CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY || '3', 10);

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function mapWithConcurrency(items, limit, worker) {
  const out = new Array(items.length);
  let idx = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}

async function scanOpenSnapshots() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: LOG_TABLE,
      FilterExpression: '#s = :open',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':open': 'open' },
      ExclusiveStartKey,
    }));
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function searchForContext(query) {
  if (!BRAVE_API_KEY) return [];
  const results = [];
  try {
    const url = `${BRAVE_NEWS_ENDPOINT}?q=${encodeURIComponent(query)}&count=5&search_lang=en&freshness=pm`;
    const resp = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': BRAVE_API_KEY } });
    if (resp.ok) {
      const data = await resp.json();
      for (const r of (data?.results || []).slice(0, 5)) {
        results.push({
          title: r.title || '',
          snippet: r.description || '',
          source: r.meta_url?.hostname || (r.url || '').split('/')[2] || 'unknown',
          url: r.url || '',
          age: r.age || '',
        });
      }
    }
  } catch (err) {
    console.warn('Brave news search failed:', err.message);
  }
  if (results.length < 2) {
    try {
      const url = `${BRAVE_WEB_ENDPOINT}?q=${encodeURIComponent(query)}&count=4&search_lang=en&text_decorations=false`;
      const resp = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': BRAVE_API_KEY } });
      if (resp.ok) {
        const data = await resp.json();
        for (const r of (data?.web?.results || []).slice(0, 4)) {
          const source = r.meta_url?.hostname || (r.url || '').split('/')[2] || 'unknown';
          if (results.some(x => x.source === source)) continue;
          results.push({ title: r.title || '', snippet: r.description || (r.extra_snippets || [])[0] || '', source, url: r.url || '', age: '' });
        }
      }
    } catch (err) {
      console.warn('Brave web search failed:', err.message);
    }
  }
  return results.slice(0, 6);
}

async function invokeLLM(prompt) {
  if (!LLM_KEY) throw new Error('XAI_API_KEY (LLM key) is not configured');
  const resp = await fetch(LLM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_KEY}` },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) throw new Error(`LLM ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return JSON.parse(text);
}

function buildVerdictPrompt(topicTitle, trigger, context) {
  const ctx = context.length
    ? context.map((c, i) => `[${i + 1}] (${c.source}${c.age ? ', ' + c.age : ''}) ${c.title}: ${c.snippet}`).join('\n')
    : '(no search results found)';
  return [
    'You verify whether a specific forecast trigger actually occurred. Respond with ONLY valid JSON, no markdown.',
    '',
    `Today's date: ${today()}.`,
    `Story context: ${topicTitle}`,
    `Trigger to verify: "${trigger.text}"`,
    `It was forecast to occur by: ${trigger.deadline}.`,
    '',
    'Recent search results:',
    ctx,
    '',
    'Based ONLY on the search results above, did this trigger occur on or before its deadline? Do not use prior knowledge or assumptions — if the results do not clearly establish it either way, answer "unclear".',
    'Return exactly: {"verdict":"fired|not_fired|unclear","confidence":0.0-1.0,"citation":"source hostname or short quote backing the verdict","reasoning":"1-2 sentences"}',
  ].join('\n');
}

// Gather triggers needing a proposal: due (deadline <= today), no existing
// proposal, no human-confirmed final verdict.
function dueTriggers(item) {
  const t = today();
  const due = [];
  for (const s of item.scenarios || []) {
    for (const trig of s.triggers || []) {
      if (!trig.deadline) continue;
      if (trig.finalVerdict) continue;
      if (trig.proposal) continue;
      if (trig.deadline <= t) due.push({ scenario: s, trigger: trig });
    }
  }
  return due;
}

exports.handler = async () => {
  const snapshots = await scanOpenSnapshots();
  console.log(`Scanned ${snapshots.length} open snapshots`);

  // Flatten all due triggers across snapshots, cap per run.
  const work = [];
  for (const item of snapshots) {
    for (const d of dueTriggers(item)) {
      work.push({ item, scenario: d.scenario, trigger: d.trigger });
      if (work.length >= MAX_RESOLVE_PER_RUN) break;
    }
    if (work.length >= MAX_RESOLVE_PER_RUN) break;
  }
  console.log(`${work.length} due triggers to propose (cap ${MAX_RESOLVE_PER_RUN})`);

  if (!work.length) return { proposed: 0, snapshots: snapshots.length };

  let proposed = 0;
  await mapWithConcurrency(work, LLM_CONCURRENCY, async (w) => {
    try {
      const ctx = await searchForContext(`${w.item.title} ${w.trigger.text}`);
      const v = await invokeLLM(buildVerdictPrompt(w.item.title, w.trigger, ctx));
      w.trigger.proposal = {
        verdict: ['fired', 'not_fired', 'unclear'].includes(v.verdict) ? v.verdict : 'unclear',
        confidence: typeof v.confidence === 'number' ? v.confidence : null,
        citation: (v.citation || '').toString().slice(0, 400),
        reasoning: (v.reasoning || '').toString().slice(0, 600),
        sources: ctx.map(c => ({ source: c.source, url: c.url })).slice(0, 6),
        proposedAt: new Date().toISOString(),
      };
      w.trigger.needsConfirm = true;
      proposed++;
    } catch (err) {
      console.warn(`Verdict failed for trigger "${(w.trigger.text || '').slice(0, 50)}": ${err.message}`);
    }
  });

  // Persist mutated snapshots (dedupe by PK+SK).
  const touched = new Map();
  for (const w of work) touched.set(`${w.item.PK}|${w.item.SK}`, w.item);
  for (const item of touched.values()) {
    item.lastResolvedAt = new Date().toISOString();
    await ddb.send(new PutCommand({ TableName: LOG_TABLE, Item: item }));
  }

  console.log(`Proposed ${proposed} verdicts across ${touched.size} snapshots`);
  return { proposed, snapshots: snapshots.length, touched: touched.size };
};
