'use strict';

const { keepDayZero } = require('./_shared/dayZero');
const { chat, stripCodeFence } = require('./_shared/llm');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const refreshPolicy = require('./refreshPolicy');
const { writeCountryNote } = require('./recordNotes');
const ISO3_NAMES = require('./_shared/iso3Names.json');
const { resolveIso3 } = require('./_shared/resolveIso3');
const NR = require('./_shared/noteReads');
const { normalizeDimensions, deriveRisk, clampScore, tierFromScore } = require('./_shared/riskDimensions');

let EDITORIAL_FACTS = {};
try {
  EDITORIAL_FACTS = require('./country_facts.json');
} catch (err) {
  console.warn('country_facts.json not found — editorial context disabled');
}

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const GROK_MODEL = process.env.GROK_MODEL || 'deepseek-v4-pro'; // fallback only; the env sets the live model
const GROK_KEY = process.env.XAI_API_KEY || '';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '5000', 10);
const TEMPERATURE = Number(process.env.TEMPERATURE || '0.3');
const TOP_P = Number(process.env.TOP_P || '0.9');

const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;

const COUNTRY_PK_PREFIX = 'COUNTRY#';
const COUNTRY_SK = 'COUNTRY_INTELLIGENCE';
const THREAD_PK_PREFIX = 'THREAD#';
const THREAD_SK = 'THREAD_ANALYSIS';

const LLM_CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY || '4', 10);

async function mapWithConcurrency(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}
const COUNTRY_TTL_DAYS = 90;
const TOP_THREAD_IDS = 10;
const MAX_COUNTRIES = 20; // kept for reference; the policy's topN / maxExtras (below) now set the cap
const WORLD_LATEST_URL = process.env.WORLD_LATEST_URL || 'https://globalperspective.net/data/world/latest.json';
const POLICY_CFG = {
  baselineHours: Number(process.env.COUNTRY_BASELINE_HOURS || refreshPolicy.DEFAULT_CFG.baselineHours),
  jumpMin: Number(process.env.COVERAGE_JUMP_MIN || refreshPolicy.DEFAULT_CFG.jumpMin),
  jumpFactor: Number(process.env.COVERAGE_JUMP_FACTOR || refreshPolicy.DEFAULT_CFG.jumpFactor),
  archiveDays: 30,
  topN: Number(process.env.COUNTRY_TOP_N || MAX_COUNTRIES),
  maxExtras: Number(process.env.COUNTRY_MAX_ALERT_EXTRAS || refreshPolicy.DEFAULT_CFG.maxExtras),
};

// Public world file (the same object the site reads). Any failure => no alerts: the weekly baseline
// still works, an outage of the file can never stop briefings.
async function loadWorld() {
  try {
    const res = await fetch(WORLD_LATEST_URL, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'gp-country-intel/1.0' } });
    if (!res.ok) return { ok: false, status: res.status, world: null };
    return { ok: true, status: res.status, world: await res.json() };
  } catch (err) {
    return { ok: false, status: `error: ${err.message}`, world: null };
  }
}
const ARCHIVE_DAYS = 30;

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

// ─── Handler ─────────────────────────────────────────────────────────────────

let RUN_ID = new Date().toISOString(); // reset per invocation in the handler
// NOTES_READS (decision 0053): the story analyses, the previous briefing, the recent corrections and the country facts are read from
// SummarizeAndPredict (ddb, default), the record's notes (notes), or DynamoDB with differences logged [notes-compare] (compare).
const src = NR.lambdaSource();
const iso3Of = (name) => { const r = resolveIso3(name); return r && r.iso3; };

exports.handler = async (event = {}) => {
  RUN_ID = new Date().toISOString();
  src.reset(); // a run reads the notes as its previous run left them
  const dryRun = Boolean(event && event.dryRun);
  console.log(`Country intelligence started${dryRun ? ' (DRY RUN: no LLM, no writes)' : ''}`);

  if (!TOPICS_TABLE || !SUMMARY_TABLE) {
    console.error('Missing table configuration: TOPICS_DDB_TABLE or SUMMARIZE_PREDICT_TABLE');
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

  const grouped = groupByCountry(entries, threadAnalyses);
  // R1b: region / aggregate keys are not briefed (existing records stay untouched)
  const countries = grouped.filter((c) => refreshPolicy.isCountryName(c.countryName));
  const excluded = grouped.filter((c) => !refreshPolicy.isCountryName(c.countryName));
  console.log(`Found ${grouped.length} keys with 2+ articles: ${countries.length} countries, ${excluded.length} excluded as regions / aggregates (${excluded.map((c) => c.countryName).join(', ') || 'none'})`);

  const now = new Date();
  const worldRes = await loadWorld();
  const hot = refreshPolicy.hotCountriesFromWorld(worldRes.world, ISO3_NAMES);
  console.log(`[world] ${WORLD_LATEST_URL} -> ${worldRes.ok ? 'ok' : 'FAILED'} (${worldRes.status}); alert countries: ${[...hot.keys()].join(', ') || 'none'}`);

  const candidates = countries.filter((c, i) => i < POLICY_CFG.topN || hot.has(refreshPolicy.canonicalName(c.countryName)));
  const existingByName = {};
  await mapWithConcurrency(candidates, 8, async (c) => { existingByName[c.countryName] = await readExisting(c.countryName); });
  const plan = refreshPolicy.planRun({ countries: candidates, existingByName, hot, now, cfg: POLICY_CFG });
  for (const p of plan) console.log(`[country] ${p.country} | ${p.tier} | ${p.refresh ? 'REFRESH' : 'skip'} | ${p.reason}${p.detail ? ` (${p.detail})` : ''}`);

  if (dryRun) {
    const keys = countries.map((c) => c.countryName);
    return {
      statusCode: 200,
      dryRun: true,
      world: { url: WORLD_LATEST_URL, ok: worldRes.ok, status: worldRes.status, situations: (worldRes.world?.situations || []).length },
      alerts: Object.fromEntries([...hot.entries()].map(([k, v]) => [k, v.map((a) => `${a.kind}:${a.id}`)])),
      alertsWithoutRecord: refreshPolicy.unmatchedAlerts(hot, countries),
      aliasedRecordKeys: keys.filter((k) => refreshPolicy.canonicalName(k) !== k.trim().toLowerCase()).map((k) => `${k} -> ${refreshPolicy.canonicalName(k)}`),
      excludedKeys: excluded.map((c) => ({ key: c.countryName, articles: c.totalArticles })),
      plan,
      counts: plan.reduce((a, p) => { const k = p.refresh ? `refresh:${p.reason}` : `skip:${p.reason}`; a[k] = (a[k] || 0) + 1; return a; }, {}),
    };
  }

  const byName = Object.fromEntries(candidates.map((c) => [c.countryName, c]));
  const todo = plan.filter((p) => p.refresh);
  let generated = 0;
  let skipped = plan.length - todo.length;
  let failed = 0;
  const reasons = {};

  await mapWithConcurrency(todo, LLM_CONCURRENCY, async (p) => {
    const country = byName[p.country];
    try {
      const analysis = await generateCountryIntelligence(country);
      await writeAnalysis(country.countryName, analysis, country);
      generated++;
      reasons[p.reason] = (reasons[p.reason] || 0) + 1;
      console.log(`Generated intelligence for ${country.countryName} [${p.reason}] (${country.totalArticles} articles, ${country.threads.length} threads)`);
    } catch (err) {
      failed++;
      console.error(`Failed to analyze ${country.countryName}:`, err.message);
    }
  });

  const summary = `Country intelligence complete: ${generated} generated (${Object.entries(reasons).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}), ${skipped} skipped, ${failed} failed`;
  console.log(summary);
  return { statusCode: 200, body: summary };
};

// ─── Data loading ────────────────────────────────────────────────────────────

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
        for (const e of (i === 0 ? keepDayZero(Item.entries) : Item.entries)) {
          entries.push({
            topicId: e.topicId,
            threadId: e.threadId || null,
            title: e.title,
            date: dateStr,
            regions: e.regions || [],
            category: e.category || '',
            sources: e.sources || [],
            ai: e.ai || {},
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
      const Item = await src.via(`threadAnalysis ${threadId}`, async () => {
        const { Item: row } = await ddb.send(new GetCommand({
          TableName: SUMMARY_TABLE,
          Key: { PK: `${THREAD_PK_PREFIX}${threadId}`, SK: THREAD_SK },
        }));
        return row || null;
      }, async () => {
        const row = NR.storyAnalysis(await src.notes.all('story_analysis'), threadId);
        return row ? { PK: `${THREAD_PK_PREFIX}${threadId}`, SK: THREAD_SK, ...row } : null;
      });
      if (Item) analyses[threadId] = Item;
    } catch {}
  }));

  return analyses;
}

// ─── Country grouping ────────────────────────────────────────────────────────

function groupByCountry(entries, threadAnalyses) {
  const countryMap = {};

  for (const entry of entries) {
    // Records are keyed by the canonical short name ("USA" and "United States" are one record, "West Bank"
    // is Palestine); regions / aggregates keep their raw name and are filtered out by isCountryName.
    const keys = new Set((entry.regions || []).map((region) => resolveIso3(region)?.name || region));
    for (const region of keys) {
      if (!countryMap[region]) {
        countryMap[region] = {
          countryName: region,
          entries: [],
          threadIds: new Set(),
          categories: {},
          dates: new Set(),
        };
      }
      const c = countryMap[region];
      c.entries.push(entry);
      c.dates.add(entry.date);
      if (entry.threadId) c.threadIds.add(entry.threadId);

      const cat = (entry.category || 'other').toLowerCase();
      c.categories[cat] = (c.categories[cat] || 0) + 1;
    }
  }

  return Object.values(countryMap)
    .filter(c => c.entries.length >= 2)
    .map(c => {
      const threadIds = [...c.threadIds];
      const threads = threadIds.map(tid => {
        const threadEntries = c.entries.filter(e => e.threadId === tid);
        const analysis = threadAnalyses[tid] || null;
        return {
          threadId: tid,
          title: analysis?.threadTitle || threadEntries[threadEntries.length - 1]?.title || 'Unknown',
          category: threadEntries[0]?.category || 'other',
          articleCount: threadEntries.length,
          trajectory: analysis?.trajectory || null,
          storyArc: analysis?.storyArc || null,
          keyActors: Array.isArray(analysis?.keyActors) ? analysis.keyActors : [],
        };
      });

      const singleEntries = c.entries.filter(e => !e.threadId || !c.threadIds.has(e.threadId) || threads.find(t => t.threadId === e.threadId)?.articleCount === 1);

      const sortedDates = [...c.dates].sort();
      const dominantCategory = Object.entries(c.categories)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';

      return {
        countryName: c.countryName,
        topThreadIds: threads.slice().sort((a, b) => b.articleCount - a.articleCount).slice(0, TOP_THREAD_IDS).map((t) => t.threadId),
        totalArticles: c.entries.length,
        entryDates: c.entries.map((e) => e.date),
        threads: threads.filter(t => t.articleCount >= 2).sort((a, b) => b.articleCount - a.articleCount),
        singleEntries: singleEntries.slice(0, 10),
        dominantCategory,
        categories: c.categories,
        dateRange: { from: sortedDates[0], to: sortedDates[sortedDates.length - 1] },
        dayCount: sortedDates.length,
      };
    })
    .sort((a, b) => b.totalArticles - a.totalArticles);
}

// ─── Existing analysis check ─────────────────────────────────────────────────

async function readExisting(countryName) {
  try {
    return await src.via(`readExisting ${countryName}`, async () => {
      const { Item } = await ddb.send(new GetCommand({
        TableName: SUMMARY_TABLE,
        Key: { PK: `${COUNTRY_PK_PREFIX}${countryName}`, SK: COUNTRY_SK },
      }));
      return Item || null;
    }, async () => {
      const iso3 = iso3Of(countryName);
      const row = iso3 && NR.countryIntelligence(await src.notes.all('country'), iso3);
      return row ? { PK: `${COUNTRY_PK_PREFIX}${countryName}`, SK: COUNTRY_SK, ...row } : null;
    });
  } catch {
    return null;
  }
}

// Feed-forward (living-analysis 1b.5): recent GROUNDED drift notes written by
// newsDriftCorrector, so the next read builds on its own corrections (continuity) rather
// than re-discovering them. Low authority — informational trajectory, update on new evidence.
async function buildDriftBlock(countryName) {
  try {
    const Items = await src.via(`recentDrift ${countryName}`, async () => {
      const { Items: rows } = await ddb.send(new QueryCommand({
        TableName: SUMMARY_TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :d)',
        ExpressionAttributeValues: { ':pk': `${COUNTRY_PK_PREFIX}${countryName}`, ':d': 'DRIFT#' },
        ScanIndexForward: false,
        Limit: 2,
      }));
      return rows || [];
    }, async () => {
      const iso3 = iso3Of(countryName);
      return iso3 ? NR.countryDrift(await src.notes.all('drift'), iso3, 2) : [];
    }, (rows) => rows.map(({ PK, SK, ttl, ...r }) => r));
    const notes = (Items || []).filter((n) => n && n.whyChanged);
    if (!notes.length) return '';
    const lines = notes.map((n) => {
      const lvl = n.changeLevel ? `${n.changeLevel.from}→${n.changeLevel.to}` : '';
      const sc = n.changeScore ? `${n.changeScore.from}→${n.changeScore.to}` : '';
      const ev = n.triggerEvent?.title ? ` — because: ${n.triggerEvent.title}` : '';
      return `- As of ${n.asOf}: risk moved ${[lvl, sc].filter(Boolean).join(' / ')}${ev}. ${n.whyChanged}`;
    }).join('\n');
    return `\n\n=== RECENT CORRECTIONS TO OUR READ (${countryName}) — continuity, low authority ===\nThese are our own recently-logged, event-grounded shifts. Maintain continuity with them: do NOT re-announce a shift we already noted as if it were new; but DO revise if today's evidence contradicts them.\n${lines}\n`;
  } catch {
    return '';
  }
}

// ─── AI generation ───────────────────────────────────────────────────────────

// Load automated facts from DDB (written by newsCountryFactsUpdater) and merge into
// EDITORIAL_FACTS. JSON operator entries always take precedence over DDB auto-entries.
async function loadAndMergeDDBFacts(countryName) {
  try {
    const record = await src.via(`countryFacts ${countryName}`, async () => {
      const res = await ddb.send(new GetCommand({
        TableName: SUMMARY_TABLE,
        Key: { PK: `FACTS#${countryName}`, SK: 'COUNTRY_FACTS' },
      }));
      return res.Item || null;
    }, async () => {
      const iso3 = iso3Of(countryName);
      const row = iso3 && NR.countryFacts(await src.notes.all('country_facts'), iso3);
      return row ? { PK: `FACTS#${countryName}`, SK: 'COUNTRY_FACTS', ...row } : null;
    });
    if (!record) return;
    const existing = EDITORIAL_FACTS[countryName] || {};
    EDITORIAL_FACTS[countryName] = {
      currentLeadership: record.leadershipString,
      _autoSource: 'wikidata',
      _autoUpdatedAt: record.lastUpdatedAt,
      ...existing, // JSON fields win if set
    };
    if (record.acledData && !existing.activeConflicts?.length) {
      const acled = record.acledData;
      EDITORIAL_FACTS[countryName]._acledSummary =
        `${acled.eventCount30d} conflict events in past 30 days (ACLED, as of ${acled.retrievedAt?.slice(0, 10) || '?'}). Latest: ${acled.latestEventSummary}`;
    }
  } catch (e) {
    console.warn(`DDB facts load failed for ${countryName}:`, e.message);
  }
}

// Operator-verified facts — highest authority. Supplemented by Wikidata auto-facts from DDB.
function buildEditorialBlock(countryName) {
  const facts = EDITORIAL_FACTS[countryName];
  if (!facts || typeof facts !== 'object') return '';
  if (!facts.currentLeadership && !Array.isArray(facts.activeConflicts)) return '';

  const lines = [];
  if (facts.currentLeadership) lines.push(`▸ Current leadership: ${facts.currentLeadership}`);
  if (facts.government) lines.push(`▸ Government: ${facts.government}`);
  if (Array.isArray(facts.activeConflicts) && facts.activeConflicts.length) {
    lines.push(`▸ Active conflicts:`);
    facts.activeConflicts.forEach(c => {
      lines.push(`    - ${c.name} (started ${c.startDate})`);
      if (c.trigger) lines.push(`      Trigger: ${c.trigger}`);
      if (c.currentStatus) lines.push(`      Current status: ${c.currentStatus}`);
    });
  }
  if (facts._acledSummary) lines.push(`▸ Conflict activity (auto): ${facts._acledSummary}`);

  if (!lines.length) return '';

  const stamp = facts.lastUpdated ? ` (last reviewed ${facts.lastUpdated} by operator)` : '';
  return `\n=== EDITORIAL CONTEXT for ${countryName}${stamp} — OPERATOR-VERIFIED, HIGHEST AUTHORITY ===
These are facts verified by the platform operator. They override the archive if contradicted. Use the names, dates, and triggers below as the canonical reference.

${lines.join('\n')}
`;
}

async function generateCountryIntelligence(country) {
  const threadBlock = country.threads.map((t, i) => {
    const arcSnippet = t.storyArc ? `\n  Story arc: ${t.storyArc.slice(0, 300)}` : '';
    const trajSnippet = t.trajectory ? `\n  Trajectory: ${t.trajectory.slice(0, 250)}` : '';
    const actorSnippet = t.keyActors?.length
      ? `\n  Actors: ${t.keyActors.map(a => `${a.name} (${a.role})`).join(', ')}`
      : '';
    return `Thread ${i + 1}: "${t.title}" [${t.category}] — ${t.articleCount} articles${arcSnippet}${trajSnippet}${actorSnippet}`;
  }).join('\n\n');

  const singleBlock = country.singleEntries.length > 0
    ? '\n\n=== SINGLE ARTICLES (no multi-day thread yet) ===\n' +
      country.singleEntries.map(e => `- ${e.date}: "${e.title}" [${e.category}] (topicId: ${e.topicId || 'unknown'})`).join('\n')
    : '';

  const catBreakdown = Object.entries(country.categories)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(', ');

  await loadAndMergeDDBFacts(country.countryName);
  const editorialBlock = buildEditorialBlock(country.countryName);

  const driftBlock = await buildDriftBlock(country.countryName);

  const prompt = `You are a geopolitical intelligence analyst writing a country briefing for a sophisticated news intelligence platform. Below is all tracked coverage for ${country.countryName} over the past ${country.dayCount} days (${country.dateRange.from} to ${country.dateRange.to}).

AUTHORITY HIERARCHY (apply in order when facts conflict):
  1. EDITORIAL CONTEXT (operator-verified) — highest authority
  2. ARCHIVE ENTRIES + THREAD ANALYSES
  3. RECENT CORRECTIONS (our own logged trajectory — continuity only, never overrides new evidence)
${editorialBlock || ''}${driftBlock || ''}
=== OVERVIEW ===
Country: ${country.countryName}
Total articles: ${country.totalArticles} across ${country.dayCount} days
Active story arcs: ${country.threads.length}
Category breakdown: ${catBreakdown}

=== MULTI-DAY STORY ARCS ===
${threadBlock || 'None'}
${singleBlock}

Generate a JSON object with exactly these fields:

=== HARD CONSTRAINTS ===
- The EDITORIAL CONTEXT (if present) is the canonical source of truth. If it names a current leader, use that name. If it provides a conflict startDate or trigger, cite that as the actual beginning of the crisis even if earlier archive entries only reference ongoing events.
- If archive entries contradict EDITORIAL CONTEXT, defer to editorial context. Do not cite deceased or succeeded leaders as active decision-makers.
- When leadership has changed, note the transition once (e.g., "following the succession of X by Y on {date}") then proceed with the current leader throughout.
- The bluf and headline must reflect current leadership, not leadership from any stale archive window.
- When a conflict's start date from editorial context predates the archive window, use the editorial trigger as the causal anchor in backgroundTimeline (as the earliest entry) rather than treating the first archive entry as the start of the crisis.

1. "headline": A sharp 8-12 word headline capturing the country's overall situation right now. Journalistic tone, no clickbait. Must reflect current leadership if a succession occurred.

2. "bluf": ONE sentence — the bottom-line-up-front assessment. This is the single most important thing a reader needs to know. Be direct and specific.

3. "keyDevelopments": Array of 5-7 objects, each with "date" (YYYY-MM-DD) and "text" (one sentence describing what happened). Most recent first. Reference specific events, actors, and numbers. These form a visual timeline.

4. "whyItMatters": 2-3 sentences explaining the broader significance. Use **double asterisks** around the 3-5 most critical phrases so the frontend can bold them for scanners. Example: "**Oil supply disruption** threatens **European energy security** as winter approaches."

5. "backgroundTimeline": Array of 10-15 objects representing ALL significant events chronologically (oldest first). Each object has:
   - "date" (YYYY-MM-DD)
   - "event" (1 sentence describing what happened — specific actors, numbers, outcomes)
   - "category" (one of: "conflict", "politics", "economy", "diplomacy", "security", "society")
   - "topicId" (if a matching article exists in the provided data, include its topicId; otherwise null)
   This forms a visual horizontal timeline. Be comprehensive — cover the full date range.

6. "crossThreadInsight": 1-2 paragraphs identifying connections between different story arcs. How does the political situation affect the economic outlook? Name specific actors and institutions. Use **double asterisks** on key phrases.

7. "trajectory": One of "escalating", "stable", "de-escalating" — the overall direction.

8. "trajectoryDetail": 2 paragraphs on where ${country.countryName} is heading in the next 1-4 weeks. Name the 2-3 most likely scenarios (most likely first), with specific triggers or dates. Use **double asterisks** on key phrases.

9. "riskSignals": Array of 3-4 strings — specific, concrete events or thresholds to watch in the NEXT 1-2 weeks from today (${new Date().toISOString().slice(0, 10)}). All dates must be in the future. Name institutions, actors, and approximate dates. Example: "Congressional vote on defense spending expected by April 1" — NOT references to past events or vague statements.

10. "dimensions": Object scoring this country's CURRENT risk across four INDEPENDENT axes. For each axis provide {"score": integer 0-100, "why": ONE sentence citing the specific arc/event from the data above that justifies the score} — or null when the data gives genuinely no signal for that axis. Be sparing: most countries are NOT elevated on all four — use null rather than a filler mid-number. Axes:
   - "conflict": armed violence, military operations, armed-actor intensity
   - "political": institutional stability, governance, legitimacy, protest/unrest
   - "economic": financial stress, sanctions, trade/market disruption
   - "humanitarian": displacement, civilian harm, disaster, aid crisis
   Per-axis calibration: 0-24 = low, 25-49 = moderate, 50-74 = elevated, 75-100 = severe. (riskScore and riskLevel are derived from these — do NOT output them separately.)

11. "keyActors": Array of up to 8 objects — the most important named individuals or institutions in this country's coverage. Each object: {"name": full name, "role": institutional role (e.g. "President", "Economy Minister", "Central Bank Governor"), "threadCount": number of story arcs they appear in}. Sort by prominence (threadCount desc, then overall importance). Include current leaders from editorial context even if mentioned only briefly. Do NOT include country names as actors — only named people or institutions.

Return ONLY valid JSON. No markdown fences, no commentary, no extra keys.`;

  const { content, modelId, latencyMs } = await invokeGrok(prompt);
  const cleaned = stripCodeFence(content);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse Grok response as JSON: ${err.message}\nRaw: ${cleaned.slice(0, 200)}`);
  }

  if (!parsed.bluf || !parsed.keyDevelopments) {
    throw new Error(`Missing required fields in response: ${Object.keys(parsed).join(', ')}`);
  }

  return { ...parsed, modelId, latencyMs };
}

// ─── Write to DynamoDB ───────────────────────────────────────────────────────

async function writeAnalysis(countryName, analysis, country) {
  const now = new Date();
  const ttl = Math.floor(now.getTime() / 1000) + COUNTRY_TTL_DAYS * 86400;
  const generatedAt = now.toISOString();
  const dateKey = generatedAt.slice(0, 10);

  // Scoring v2: derive the legacy scalar (riskScore/riskLevel) from the dimensions
  // vector — the WORST axis. Fall back to a legacy riskScore/riskLevel if a
  // transitional model response omits dimensions, so a rollout can never write null.
  const dimensions = normalizeDimensions(analysis.dimensions);
  let { riskScore, riskLevel, lead } = deriveRisk(dimensions);
  if (riskScore == null && typeof analysis.riskScore === 'number') {
    riskScore = clampScore(analysis.riskScore);
    riskLevel = analysis.riskLevel || tierFromScore(riskScore);
  }

  const coreItem = {
    countryName,
    headline: analysis.headline || null,
    bluf: analysis.bluf || null,
    keyDevelopments: Array.isArray(analysis.keyDevelopments) ? analysis.keyDevelopments.slice(0, 7) : [],
    whyItMatters: analysis.whyItMatters || null,
    situationSummary: analysis.situationSummary || null,
    backgroundTimeline: Array.isArray(analysis.backgroundTimeline) ? analysis.backgroundTimeline.slice(0, 15) : [],
    crossThreadInsight: analysis.crossThreadInsight || null,
    trajectory: analysis.trajectory || 'stable',
    trajectoryDetail: analysis.trajectoryDetail || null,
    riskSignals: Array.isArray(analysis.riskSignals) ? analysis.riskSignals.slice(0, 4) : [],
    riskLevel: riskLevel || 'moderate',
    riskScore,
    dimensions,
    lead,
    keyActors: Array.isArray(analysis.keyActors) ? analysis.keyActors.slice(0, 8) : [],
    dominantCategory: country.dominantCategory,
    categories: country.categories,
    totalArticles: country.totalArticles,
    activeArcCount: country.threads.length,
    threadIds: country.topThreadIds,
    dateRange: country.dateRange,
    dayCount: country.dayCount,
    generatedAt,
    model: analysis.modelId || GROK_MODEL,
    latencyMs: analysis.latencyMs || 0,
    ttl,
  };

  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: { PK: `${COUNTRY_PK_PREFIX}${countryName}`, SK: COUNTRY_SK, ...coreItem },
  }));

  // Write daily snapshot for sparkline / riskDelta
  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: {
      PK: `${COUNTRY_PK_PREFIX}${countryName}`,
      SK: `HISTORY#${dateKey}`,
      countryName,
      dateKey,
      riskLevel: coreItem.riskLevel,
      riskScore,
      dimensions,
      lead,
      trajectory: coreItem.trajectory,
      headline: coreItem.headline,
      generatedAt,
      ttl,
    },
  }));

  console.log(`Wrote COUNTRY_INTELLIGENCE + HISTORY#${dateKey} for ${countryName} (riskScore: ${riskScore})`);
  await writeCountryNote({ countryName, item: coreItem, runId: RUN_ID });
}

// ─── Grok API ────────────────────────────────────────────────────────────────

async function invokeGrok(prompt) {
  const r = await chat({ step: 'country_intel', model: GROK_MODEL, user: prompt, maxTokens: MAX_TOKENS, temperature: TEMPERATURE, topP: TOP_P });
  return { modelId: r.model, content: r.content, latencyMs: r.latencyMs };
}

exports.reads = { loadThreadAnalyses, readExisting, buildDriftBlock, loadAndMergeDDBFacts, editorialFacts: () => EDITORIAL_FACTS }; // for tests (NOTES_READS)
