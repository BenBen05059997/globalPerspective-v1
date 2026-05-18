'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

let EDITORIAL_FACTS = {};
try {
  EDITORIAL_FACTS = require('./country_facts.json');
} catch (err) {
  console.warn('country_facts.json not found — editorial context disabled');
}

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const GROK_MODEL = process.env.GROK_MODEL || 'grok-4-1-fast-non-reasoning';
const GROK_ENDPOINT = process.env.GROK_API_URL || 'https://api.x.ai/v1/chat/completions';
const GROK_KEY = process.env.XAI_API_KEY || '';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '4000', 10);
const TEMPERATURE = Number(process.env.TEMPERATURE || '0.2');
const TOP_P = Number(process.env.TOP_P || '0.9');

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';
const BRAVE_NEWS_ENDPOINT = 'https://api.search.brave.com/res/v1/news/search';
const BRAVE_WEB_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;

const PAIR_PK_PREFIX = 'PAIR#';
const PAIR_SK = 'PAIR_ANALYSIS';
const COUNTRY_PK_PREFIX = 'COUNTRY#';
const COUNTRY_SK = 'COUNTRY_INTELLIGENCE';
const THREAD_PK_PREFIX = 'THREAD#';
const THREAD_SK = 'THREAD_ANALYSIS';
const PAIR_TTL_DAYS = 90;
const ARCHIVE_DAYS = 30;

// Pairs to process on scheduled runs (manual invocation overrides this).
// Selected data-driven: top 10 by actual archive co-occurrence as of 2026-04-18.
// Revisit monthly — if a pair drops below ~15 co-occurrences / month, consider replacing.
const DEFAULT_PAIRS = [
  ['Iran', 'United States'],       // ~176
  ['Israel', 'Lebanon'],           // ~98
  ['Iran', 'Israel'],              // ~64
  ['Russia', 'Ukraine'],           // ~62
  ['Israel', 'United States'],     // ~40
  ['Iran', 'Pakistan'],            // ~39
  ['China', 'United States'],      // ~37
  ['Pakistan', 'United States'],   // ~34
  ['United Kingdom', 'United States'], // ~16
  ['Cuba', 'United States'],       // ~14
];

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, { marshallOptions: { removeUndefinedValues: true } });

// ─── Region resolution ────────────────────────────────────────────────────────

const REGION_MAP = {
  'European Union': ['Germany', 'France', 'Italy', 'Spain', 'Poland', 'Netherlands', 'Belgium', 'Sweden', 'Austria', 'Denmark', 'Finland', 'Ireland', 'Portugal', 'Czech Republic', 'Romania', 'Hungary', 'Bulgaria', 'Slovakia', 'Croatia', 'Lithuania', 'Latvia', 'Estonia', 'Slovenia', 'Luxembourg', 'Cyprus', 'Malta'],
  'EU': ['Germany', 'France', 'Italy', 'Spain', 'Poland', 'Netherlands', 'Belgium', 'Sweden', 'Austria', 'Denmark', 'Finland', 'Ireland', 'Portugal', 'Czech Republic', 'Romania', 'Hungary'],
  'Middle East': ['Israel', 'Iran', 'Saudi Arabia', 'UAE', 'United Arab Emirates', 'Turkey', 'Egypt', 'Jordan', 'Lebanon', 'Syria', 'Iraq', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Yemen', 'Palestine', 'Gaza'],
  'North America': ['United States', 'USA', 'Canada', 'Mexico'],
  'South America': ['Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Venezuela', 'Ecuador', 'Bolivia', 'Uruguay', 'Paraguay'],
  'Latin America': ['Mexico', 'Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Venezuela', 'Cuba', 'Ecuador', 'Bolivia'],
  'Southeast Asia': ['Thailand', 'Vietnam', 'Indonesia', 'Malaysia', 'Philippines', 'Singapore', 'Myanmar', 'Cambodia', 'Laos', 'Brunei', 'Timor-Leste'],
  'East Asia': ['China', 'Japan', 'South Korea', 'North Korea', 'Taiwan', 'Mongolia'],
  'South Asia': ['India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan', 'Maldives', 'Afghanistan'],
  'Central Asia': ['Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan'],
  'Eastern Europe': ['Russia', 'Ukraine', 'Belarus', 'Moldova', 'Poland', 'Czech Republic', 'Slovakia', 'Hungary', 'Romania', 'Bulgaria', 'Serbia', 'Croatia', 'Bosnia', 'Albania', 'Montenegro', 'North Macedonia', 'Kosovo'],
  'Western Europe': ['Germany', 'France', 'United Kingdom', 'UK', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Portugal', 'Ireland'],
  'Africa': ['South Africa', 'Nigeria', 'Egypt', 'Ethiopia', 'Kenya', 'Ghana', 'Morocco', 'Algeria', 'Tunisia', 'Libya', 'Sudan', 'Congo', 'Tanzania', 'Uganda', 'Mozambique', 'Zimbabwe', 'Zambia', 'Angola', 'Cameroon', 'Ivory Coast', 'Senegal', 'Mali', 'Niger', 'Chad', 'Somalia'],
  'Sub-Saharan Africa': ['South Africa', 'Nigeria', 'Ethiopia', 'Kenya', 'Ghana', 'Congo', 'Tanzania', 'Uganda', 'Mozambique', 'Zimbabwe', 'Zambia', 'Angola', 'Cameroon', 'Ivory Coast', 'Senegal'],
  'Balkans': ['Serbia', 'Croatia', 'Bosnia', 'Albania', 'Montenegro', 'North Macedonia', 'Kosovo', 'Slovenia', 'Bulgaria', 'Romania'],
  'Persian Gulf': ['Saudi Arabia', 'UAE', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Iran', 'Iraq'],
  'Caucasus': ['Georgia', 'Armenia', 'Azerbaijan'],
  'Nordic': ['Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland'],
  'G7': ['United States', 'Japan', 'Germany', 'United Kingdom', 'France', 'Italy', 'Canada'],
  'NATO': ['United States', 'United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Poland', 'Turkey', 'Canada', 'Netherlands', 'Belgium', 'Norway', 'Denmark', 'Portugal', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria', 'Slovakia', 'Croatia', 'Lithuania', 'Latvia', 'Estonia', 'Slovenia', 'Albania', 'Montenegro', 'North Macedonia'],
  'ASEAN': ['Indonesia', 'Malaysia', 'Philippines', 'Singapore', 'Thailand', 'Vietnam', 'Myanmar', 'Cambodia', 'Laos', 'Brunei'],
};

// Normalize common name variants to a canonical form
const NAME_ALIASES = {
  'USA': 'United States',
  'US': 'United States',
  'America': 'United States',
  'UK': 'United Kingdom',
  'UAE': 'United Arab Emirates',
  'North Korea': 'North Korea',
  'DPRK': 'North Korea',
  'ROK': 'South Korea',
  'PRC': 'China',
  'Palestinian Territories': 'Palestine',
  'West Bank': 'Palestine',
  'Russia Federation': 'Russia',
};

function canonicalize(name) {
  return NAME_ALIASES[name] || name;
}

// Returns all canonical country names that a given region label resolves to.
// For a plain country name, returns [canonicalize(name)].
function resolveRegion(name) {
  const norm = canonicalize(name);
  if (REGION_MAP[norm]) return REGION_MAP[norm].map(canonicalize);
  if (REGION_MAP[name]) return REGION_MAP[name].map(canonicalize);
  return [norm];
}

// Returns true if a regions array contains the given target (direct or via group)
function regionMatches(regions, target) {
  const targetNorm = canonicalize(target);
  for (const r of regions) {
    const resolved = resolveRegion(r);
    if (resolved.some(c => c === targetNorm)) return true;
  }
  return false;
}

// ─── Pair helpers ─────────────────────────────────────────────────────────────

function buildCanonicalSlug(a, b) {
  const norm = [canonicalize(a), canonicalize(b)].map(s => s.toLowerCase().replace(/\s+/g, '-')).sort();
  return norm.join('-and-');
}

// Filter archive entries to those involving both targets
function filterPairEntries(entries, a, b) {
  return entries.filter(e => {
    const regions = e.regions || [];
    return regionMatches(regions, a) && regionMatches(regions, b);
  });
}

// Deduplicate events: cluster entries that share the same date or have nearly identical titles.
// Keeps the entry with the most AI content per cluster.
function deduplicateEvents(entries) {
  if (entries.length <= 1) return entries;

  const used = new Set();
  const result = [];

  for (let i = 0; i < entries.length; i++) {
    if (used.has(i)) continue;
    const cluster = [i];
    const titleI = (entries[i].title || '').toLowerCase();

    for (let j = i + 1; j < entries.length; j++) {
      if (used.has(j)) continue;
      const titleJ = (entries[j].title || '').toLowerCase();
      // Same date OR title overlap > 50%
      const sameDate = entries[i].date === entries[j].date;
      const overlap = titleSimilarity(titleI, titleJ);
      if (sameDate && overlap > 0.3) {
        cluster.push(j);
      } else if (overlap > 0.5) {
        cluster.push(j);
      }
    }

    cluster.forEach(idx => used.add(idx));
    // Pick the entry with the richest AI content
    const best = cluster.reduce((a, b) => {
      const scoreA = aiScore(entries[a]);
      const scoreB = aiScore(entries[b]);
      return scoreA >= scoreB ? a : b;
    });
    result.push(entries[best]);
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

function aiScore(entry) {
  const ai = entry.ai || {};
  return (ai.summary || '').length + (ai.prediction || '').length + (ai.trace_cause || '').length;
}

// Jaccard token overlap on word tokens
function titleSimilarity(a, b) {
  const tokA = new Set(a.split(/\W+/).filter(Boolean));
  const tokB = new Set(b.split(/\W+/).filter(Boolean));
  if (!tokA.size || !tokB.size) return 0;
  const intersection = [...tokA].filter(t => tokB.has(t)).length;
  const union = new Set([...tokA, ...tokB]).size;
  return intersection / union;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  console.log('Pair intelligence started', JSON.stringify(event));

  if (!TOPICS_TABLE || !SUMMARY_TABLE) {
    console.error('Missing table config');
    return { statusCode: 500, body: 'Missing table config' };
  }
  if (!GROK_KEY) {
    console.error('Missing XAI_API_KEY');
    return { statusCode: 500, body: 'Missing API key' };
  }

  // Determine which pairs to process
  let pairsToProcess;
  let forceRegenerate = false;
  if (event && Array.isArray(event.pair) && event.pair.length === 2) {
    pairsToProcess = [event.pair];
    forceRegenerate = true; // manual invocation: always regenerate
  } else if (event && Array.isArray(event.pairs)) {
    pairsToProcess = event.pairs;
    forceRegenerate = true;
  } else {
    pairsToProcess = DEFAULT_PAIRS;
  }

  const entries = await readArchiveEntries(ARCHIVE_DAYS);
  console.log(`Loaded ${entries.length} archive entries across ${ARCHIVE_DAYS} days`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const [a, b] of pairsToProcess) {
    const slug = buildCanonicalSlug(a, b);
    try {
      const pairEntries = filterPairEntries(entries, a, b);
      const deduped = deduplicateEvents(pairEntries);
      console.log(`${slug}: ${pairEntries.length} raw → ${deduped.length} deduplicated entries`);

      if (deduped.length < 2) {
        console.log(`${slug}: insufficient entries, skipping`);
        skipped++;
        continue;
      }

      if (!forceRegenerate) {
        const existing = await readExistingAnalysis(slug);
        if (existing && existing.entryCount === deduped.length) {
          console.log(`${slug}: unchanged (${deduped.length} entries), skipping`);
          skipped++;
          continue;
        }
      }

      const threadAnalyses = await loadRelevantThreadAnalyses(pairEntries);
      const [intelA, intelB] = await Promise.all([
        loadCountryIntelligence(a),
        loadCountryIntelligence(b),
      ]);

      const analysis = await generatePairAnalysis({ slug, a, b, entries: deduped, threadAnalyses, intelA, intelB });
      await writeAnalysis(slug, a, b, analysis, deduped.length);
      generated++;
      console.log(`Generated pair analysis for ${slug} (${deduped.length} events, ${analysis.searchResultsCount} web refs)`);
    } catch (err) {
      failed++;
      console.error(`Failed to analyze ${slug}:`, err.message);
    }
  }

  const summary = `Pair intelligence complete: ${generated} generated, ${skipped} skipped, ${failed} failed`;
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
          if (e.threadId) {
            entries.push({
              topicId: e.topicId,
              threadId: e.threadId,
              title: e.title,
              date: dateStr,
              regions: e.regions || [],
              category: e.category || '',
              sources: e.sources || [],
              ai: e.ai || {},
            });
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to read ${key}:`, err.message);
    }
  }

  return entries;
}

async function readExistingAnalysis(slug) {
  try {
    const { Item } = await ddb.send(new GetCommand({
      TableName: SUMMARY_TABLE,
      Key: { PK: `${PAIR_PK_PREFIX}${slug}`, SK: PAIR_SK },
    }));
    return Item || null;
  } catch {
    return null;
  }
}

// Load thread analyses for the threads present in pair entries (deduplicated by threadId)
async function loadRelevantThreadAnalyses(pairEntries) {
  const threadIds = [...new Set(pairEntries.map(e => e.threadId).filter(Boolean))];
  const analyses = {};

  await Promise.all(threadIds.map(async (tid) => {
    try {
      const { Item } = await ddb.send(new GetCommand({
        TableName: SUMMARY_TABLE,
        Key: { PK: `${THREAD_PK_PREFIX}${tid}`, SK: THREAD_SK },
      }));
      if (Item) analyses[tid] = Item;
    } catch {
      // thread analysis missing — not fatal
    }
  }));

  return analyses;
}

async function loadCountryIntelligence(country) {
  try {
    const { Item } = await ddb.send(new GetCommand({
      TableName: SUMMARY_TABLE,
      Key: { PK: `${COUNTRY_PK_PREFIX}${canonicalize(country)}`, SK: COUNTRY_SK },
    }));
    return Item || null;
  } catch {
    return null;
  }
}

// ─── Analysis generation ──────────────────────────────────────────────────────

async function generatePairAnalysis({ slug, a, b, entries, threadAnalyses, intelA, intelB }) {
  const searchQuery = `${a} ${b} relations ${entries[entries.length - 1].date.slice(0, 7)}`;
  const searchResults = await searchForContext(searchQuery);

  await Promise.all([loadAndMergeDDBFacts(a), loadAndMergeDDBFacts(b)]);
  const editorialBlock = buildEditorialBlock(a, b);
  const entryBlock = buildEntryBlock(entries, threadAnalyses);
  const contextBlock = buildContextBlock(a, b, intelA, intelB);
  const referenceBlock = buildReferenceBlock(searchQuery, searchResults);

  const prompt = buildPrompt(a, b, editorialBlock, entryBlock, contextBlock, referenceBlock);

  const { content, modelId, latencyMs } = await invokeGrok(prompt);
  const cleaned = stripCodeFence(content);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse Grok response as JSON: ${err.message}\nRaw: ${cleaned.slice(0, 300)}`);
  }

  if (!parsed.pairTitle || !parsed.currentState) {
    throw new Error(`Missing required fields: ${Object.keys(parsed).join(', ')}`);
  }

  return { ...parsed, modelId, latencyMs, searchResultsCount: searchResults.length };
}

function buildEntryBlock(entries, threadAnalyses) {
  return entries.map((e, i) => {
    const regions = (e.regions || []).join(', ') || 'Unknown';
    const outlets = (e.sources || []).map(s => s.source || s.title || '').filter(Boolean).slice(0, 4).join(', ');
    const summary = e.ai?.summary ? `\n  Summary: ${e.ai.summary}` : '';
    const prediction = e.ai?.prediction ? `\n  Initial signal: ${e.ai.prediction.slice(0, 200)}` : '';
    const trace = e.ai?.trace_cause ? `\n  Cause note: ${e.ai.trace_cause.slice(0, 150)}` : '';
    const sourceStr = outlets ? `\n  Sources: ${outlets}` : '';
    const ta = threadAnalyses[e.threadId];
    const threadCtx = ta?.threadTitle ? `\n  Thread: "${ta.threadTitle}"` : '';
    return `Event ${i + 1} (${e.date}) [${e.category}]:\n  Headline: ${e.title}\n  Regions: ${regions}${threadCtx}${sourceStr}${summary}${prediction}${trace}`;
  }).join('\n\n');
}

// Load automated facts from DDB (written by newsCountryFactsUpdater) and merge into
// EDITORIAL_FACTS. JSON operator entries always take precedence over DDB auto-entries.
async function loadAndMergeDDBFacts(countryName) {
  try {
    const res = await ddb.send(new GetCommand({
      TableName: SUMMARY_TABLE,
      Key: { PK: `FACTS#${countryName}`, SK: 'COUNTRY_FACTS' },
    }));
    const record = res.Item;
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
function buildEditorialBlock(a, b) {
  const fmt = (name) => {
    const facts = EDITORIAL_FACTS[canonicalize(name)] || EDITORIAL_FACTS[name];
    if (!facts || typeof facts !== 'object') return '';
    if (!facts.currentLeadership && !Array.isArray(facts.activeConflicts)) return '';

    const lines = [`--- ${name} ---`];
    if (facts.currentLeadership) lines.push(`  Leadership: ${facts.currentLeadership}`);
    if (facts.government) lines.push(`  Government: ${facts.government}`);
    if (Array.isArray(facts.activeConflicts) && facts.activeConflicts.length) {
      facts.activeConflicts.forEach(c => {
        lines.push(`  Active conflict: ${c.name} (started ${c.startDate})`);
        if (c.trigger) lines.push(`    Trigger: ${c.trigger}`);
        if (c.currentStatus) lines.push(`    Current status: ${c.currentStatus}`);
      });
    }
    if (facts._acledSummary) lines.push(`  Conflict activity: ${facts._acledSummary}`);
    return lines.join('\n');
  };

  const blockA = fmt(a);
  const blockB = fmt(b);
  if (!blockA && !blockB) return '';

  return `\n=== EDITORIAL CONTEXT (operator-verified, HIGHEST AUTHORITY) ===
These are facts verified by the platform operator. They override the archive entries, the country intelligence profiles, and any web search results. Use the names, dates, and triggers below as the canonical reference — especially for leadership, conflict start dates, and immediate triggers.

${[blockA, blockB].filter(Boolean).join('\n\n')}
`;
}

function buildContextBlock(a, b, intelA, intelB) {
  const fmt = (name, intel) => {
    if (!intel) return `=== ${name.toUpperCase()} INTELLIGENCE: Not available ===`;
    const parts = [`=== ${name.toUpperCase()} INTELLIGENCE (as of ${intel.generatedAt?.slice(0, 10) || 'recent'}) ===`];
    if (intel.headline) parts.push(`Headline: ${intel.headline}`);
    if (intel.situationSummary) parts.push(`Situation: ${intel.situationSummary.slice(0, 600)}`);
    if (intel.trajectory) parts.push(`Trajectory: ${intel.trajectory.slice(0, 400)}`);
    if (Array.isArray(intel.riskSignals) && intel.riskSignals.length) {
      parts.push(`Risk signals: ${intel.riskSignals.slice(0, 3).join(' | ')}`);
    }
    return parts.join('\n');
  };
  return `${fmt(a, intelA)}\n\n${fmt(b, intelB)}`;
}

function buildReferenceBlock(query, results) {
  if (!results.length) return '';
  const lines = results.map((r, i) => {
    const age = r.age ? ` · ${r.age}` : '';
    return `[${i + 1}] "${r.title}" — ${r.snippet} (${r.source}${age})`;
  }).join('\n');
  return `\n=== EXTERNAL REFERENCES (web search: "${query}") ===\n${lines}\n\nCite these as [1], [2] etc. where relevant.\n`;
}

function buildPrompt(a, b, editorialBlock, entryBlock, contextBlock, referenceBlock) {
  return `You are a senior intelligence analyst writing a bilateral relationship assessment for a professional geopolitical intelligence platform. Your readers are analysts, policy professionals, and serious observers — not general audiences. Write with the density and precision of a finished intelligence product.

=== SUBJECT: ${a} — ${b} relationship ===

AUTHORITY HIERARCHY (apply in order when facts conflict):
  1. EDITORIAL CONTEXT (operator-verified) — highest authority
  2. COUNTRY INTELLIGENCE PROFILES (web-grounded)
  3. ARCHIVE EVENT ENTRIES
  4. EXTERNAL REFERENCES (Brave News)

The EDITORIAL CONTEXT (if present) is canonical for leadership names, conflict start dates, and immediate triggers. If the archive or a country profile contradicts it, defer to editorial context. The country intelligence profiles are web-grounded and supplement editorial context for domestic situation and strategic posture. Archive entries may reference leaders as active who have since been succeeded or killed — always verify against editorial context first.
${editorialBlock || ''}
=== CHRONOLOGICAL EVENTS (${a}×${b}, past 30 days, deduplicated) ===
${entryBlock}

${contextBlock}
${referenceBlock}

=== MANDATORY STYLE RULES ===
- Start from the most recent event and work backward. Do NOT open with historical background.
- Name specific dates, specific actors (below head-of-state level when relevant), specific institutions.
- Describe what each side DID, not what each side "experienced." Do not write symmetric false-balance sentences like "both sides have suffered losses."
- Label FACT vs. ASSESSMENT on non-trivial claims. FACT = confirmed by 2+ independent sources in the data. ASSESSMENT = your analytical inference.
- If the events span multiple sub-domains (trade, tech, military, diplomacy), identify those domains explicitly and analyze how they interact rather than narrating everything as one story.
- The data window may NOT cover the start of the conflict. If early entries already reference an ongoing war, ceasefire, or past event (e.g., "war continues", "killed leader"), acknowledge that the conflict predates the data window and do NOT claim the first entry is the trigger. Use external references to establish what happened before the window.
- Do NOT reference named actors as alive or active if the data reports them as killed or removed. Cross-check before citing anyone as a current decision-maker.
- Do NOT invent specific casualty numbers, intercept rates, troop counts, or dollar figures that are not present in the event data or external references. You may cite numbers FROM the data (e.g., "1,255 killed per Event 4") but do not fabricate new ones.

=== BANNED PHRASES (using any of these is a failure) ===
"tensions could rise", "the situation remains fluid", "much depends on", "various factors", "key actors" (without naming them), "could potentially", "remains to be seen", "the coming days will be critical", "both sides have suffered", "the conflict has deep historical roots" (without naming what those roots are), "further escalation", "de-escalation efforts"

=== OUTPUT FORMAT ===
Generate a JSON object with exactly these fields:

1. "pairTitle": string. A precise, journalistic title for the CURRENT state of this relationship (6-10 words). Must capture the operative dynamic, not just name the actors. No colons, no clickbait, no questions.
  GOOD: "US-Backed Israel and Iran in Active War Under Fragile Ceasefire"
  BAD: "Iran-Israel Tensions Rise" (too generic)
  BAD: "Could This Lead to World War III?" (clickbait)

2. "currentState": string. 2-3 paragraphs assessing the present moment.
  MUST include: (a) operative military/diplomatic/economic facts as of the most recent entry date, (b) named actors on both sides and their specific positions or actions, (c) at least two FACT vs. ASSESSMENT labels on non-trivial claims.
  Start with what is happening NOW, not background context. The reader already knows who ${a} and ${b} are — don't explain.
  If the most recent event is a ceasefire, state its terms, who brokered it, and what has already stressed it.
  If one side has a degraded command structure, name who was killed/removed and who (if anyone) has replaced them.

3. "timeline": array of 5-7 objects, each {date, headline, significance}. MUST be in chronological order (earliest date first).
  "date": YYYY-MM-DD format.
  "headline": ≤12 words capturing the specific development.
  "significance": 1-2 sentences explaining WHY this event was pivotal — what threshold it crossed, what option it opened or closed, what actor's calculation it changed. Do NOT just restate the headline in longer form.
  Select only PIVOTAL shifts — moments where the relationship changed state. Skip routine continuation events.

4. "trajectory": a single string (NOT an array). 2-3 paragraphs containing 2-3 named scenarios.
  Each scenario MUST have: (a) a label ("Scenario 1", most likely first), (b) a specific timeframe (e.g., "by April 22", "within 60 days", "by Q3 2026"), (c) a confidence tag: HIGH, MEDIUM, or LOW with a parenthetical reason, (d) the named actor whose decision drives it, (e) the specific trigger event, (f) downstream effects on both parties.
  Do NOT write "the situation could go either way." Commit to ranked likelihoods.

5. "rootDriver": string. 2-3 paragraphs with exactly three analytical layers:
  Layer 1 — Immediate trigger: What specific event or decision started the current escalation cycle? Name the date, the actor, and what they did. If EDITORIAL CONTEXT provides a conflict startDate and trigger, USE THAT as Layer 1 — do not cite a mid-conflict event from the archive window as the trigger. If no editorial context is provided and the trigger predates the data window (e.g., the earliest entries already reference an ongoing war), use external references and context clues to identify the trigger rather than incorrectly naming a mid-conflict event.
  Layer 2 — Medium-term enabling condition: What political, economic, or security condition made escalation possible? Why couldn't the pre-existing equilibrium absorb the trigger? Name specific policies, doctrines, elections, or structural shifts.
  Layer 3 — Long-run structural antagonism: What fundamental, non-negotiable clash guarantees this relationship will produce recurring crises regardless of current leadership? Name the specific incompatibility (territorial, ideological, economic, or security). If a named leader has been killed or removed during the data window, do NOT cite them as a current actor in this layer.
  A rootDriver that only covers Layer 1 (the trigger) is a FAILURE. All three layers are mandatory.

6. "predictions": array of 4-5 objects, each {claim, timeframe, confidence, mechanism}.
  "claim": A specific, falsifiable assertion. Must be verifiable as true or false by the stated deadline. "Tensions may rise" is NOT a prediction. "Israel will conduct at least one additional strike on Hezbollah targets in Lebanon before April 22" IS a prediction.
  "timeframe": Concrete deadline (e.g., "by April 22, 2026", "within 60 days", "by end of Q2 2026"). No open-ended predictions.
  "confidence": HIGH, MEDIUM, or LOW followed by a parenthetical reason (e.g., "MEDIUM (depends on coalition stability)").
  "mechanism": The specific causal chain — which actor does what, which triggers which response from whom. Must name at least two actors.

7. "watchItems": array of 4-6 objects, each {actor, indicator, why}.
  "actor": A specific named institution, person, or body (e.g., "Iran Assembly of Experts", "ASML", "US Pacific Command"). NOT "the international community" or "regional actors."
  "indicator": A concrete, observable event or data point (e.g., "Emergency session convened", "Daily Hormuz crossing count above 40 vessels"). NOT "changes in rhetoric" or "further developments."
  "why": 1 sentence explaining what this indicator signals for the bilateral relationship and why it matters.

Return ONLY valid JSON. No markdown fences, no commentary, no extra keys.`;
}

// ─── DynamoDB write ───────────────────────────────────────────────────────────

function classifyDataQuality(entryCount) {
  if (entryCount >= 20) return 'rich';
  if (entryCount >= 10) return 'moderate';
  if (entryCount >= 5) return 'sparse';
  return 'thin';
}

async function writeAnalysis(slug, a, b, analysis, entryCount) {
  const ttl = Math.floor(Date.now() / 1000) + PAIR_TTL_DAYS * 86400;
  const dataQuality = classifyDataQuality(entryCount);

  await ddb.send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: {
      PK: `${PAIR_PK_PREFIX}${slug}`,
      SK: PAIR_SK,
      slug,
      pairA: canonicalize(a),
      pairB: canonicalize(b),
      pairTitle: analysis.pairTitle,
      currentState: analysis.currentState,
      timeline: analysis.timeline || [],
      trajectory: analysis.trajectory || null,
      rootDriver: analysis.rootDriver || null,
      predictions: analysis.predictions || [],
      watchItems: analysis.watchItems || [],
      dataQuality,
      entryCount,
      generatedAt: new Date().toISOString(),
      model: analysis.modelId || GROK_MODEL,
      latencyMs: analysis.latencyMs || 0,
      searchResultsCount: analysis.searchResultsCount || 0,
      ttl,
    },
  }));
}

// ─── Brave Search ─────────────────────────────────────────────────────────────

async function searchForContext(query) {
  if (!BRAVE_API_KEY) return [];
  const results = [];

  try {
    const url = `${BRAVE_NEWS_ENDPOINT}?q=${encodeURIComponent(query)}&count=5&search_lang=en&freshness=pm`;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_API_KEY },
    });
    if (resp.ok) {
      const data = await resp.json();
      for (const r of (data?.results || []).slice(0, 5)) {
        results.push({
          title: r.title || '',
          snippet: r.description || '',
          source: r.meta_url?.hostname || r.url?.split('/')[2] || 'unknown',
          age: r.age || '',
          type: 'news',
        });
      }
    }
  } catch (err) {
    console.warn('Brave news search failed:', err.message);
  }

  try {
    const url = `${BRAVE_WEB_ENDPOINT}?q=${encodeURIComponent(query + ' analysis report')}&count=4&search_lang=en&text_decorations=false`;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_API_KEY },
    });
    if (resp.ok) {
      const data = await resp.json();
      for (const r of (data?.web?.results || []).slice(0, 3)) {
        const source = r.meta_url?.hostname || r.url?.split('/')[2] || 'unknown';
        if (results.some(x => x.source === source)) continue;
        results.push({
          title: r.title || '',
          snippet: r.description || (r.extra_snippets || [])[0] || '',
          source,
          age: '',
          type: 'web',
        });
      }
    }
  } catch (err) {
    console.warn('Brave web search failed:', err.message);
  }

  return results.slice(0, 8);
}

// ─── Grok invocation ──────────────────────────────────────────────────────────

async function invokeGrok(prompt) {
  const started = Date.now();
  const response = await fetch(GROK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROK_KEY}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      top_p: TOP_P,
    }),
  });

  const rawText = await response.text();
  const latencyMs = Date.now() - started;

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = rawText;
  }

  if (!response.ok) {
    const message = parsed?.error?.message || rawText || `status ${response.status}`;
    throw new Error(`Grok API error: ${message}`);
  }

  const content = extractContent(parsed);
  return { modelId: parsed?.model || GROK_MODEL, content, latencyMs };
}

function extractContent(payload) {
  if (!payload) return '';
  const msg = payload?.choices?.[0]?.message?.content;
  if (typeof msg === 'string') return stripCodeFence(msg);
  if (typeof payload === 'string') return payload.trim();
  return JSON.stringify(payload);
}

function stripCodeFence(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .replace(/,(\s*[\]}])/g, '$1')
    .trim();
}
