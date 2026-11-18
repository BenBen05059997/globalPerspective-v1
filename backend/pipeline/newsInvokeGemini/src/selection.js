'use strict';

// The topic selector's own rules, apart from the handler: the feed list, the selection prompt, the model-answer parsing and validation, the
// source enrichment call, the filters, the seen-today list (the repeat drop) and the stories we follow. No AWS client and no clock of its own (`nowMs` is an argument), so the handler
// (index.js) and the one-off recovery script (backend/record/cli/recover-late-slots.mjs, decision 0061) run the same code.

const { collapseSameEvent, dropRepeatTopics, newestPerFeed } = require('./dedupe');
const { applyEnrichment, annotateSourcesWithMetadata, sourceWithPublication } = require('./source_enrichment');
const { resolveIso3, iso3List } = require('./_shared/resolveIso3');
function canonicalIso3(values, log = console.warn) {
  const codes = (Array.isArray(values) ? values : []).map(c => String(c).trim().toUpperCase());
  const unknown = codes.filter(c => !resolveIso3(c));
  if (unknown.length) log('[selector][unknown-iso3] ' + JSON.stringify({ count: unknown.length, values: unknown }));
  return iso3List(codes).slice(0, 4);
}


// Allowed categories for topic filtering
const VALID_CATEGORIES = [
  'politics', 'economy', 'military', 'conflict', 'disaster', 'technology', 'health',
  'climate', 'science', 'business', 'society', 'energy',
];
// Words Flash returns that are not in the list but mean one of its categories (deepseek-flash returned
// `diplomacy` for 2 of 50 topics in the 2026-11-04 test; the prompt defines politics as including
// "diplomatic relations"). Mapped in the filter instead of dropping a real topic.
const CATEGORY_ALIASES = { diplomacy: 'politics' };

function slugifyTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

// Fetch up to 25 items per feed so raw capture sees them all (decision 0040 answer 2); the model's candidate pool
// stays at the previous size: the newest 8 per feed (PROMPT_POOL_PER_FEED), chosen after dedupe.
const FEED_FETCH_CAP = 25;
const PROMPT_POOL_PER_FEED = 8;

const RSS_FEEDS = [
  // --- Existing (global / Asia / South Asia) ---
  { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', source: 'bbc.com' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'aljazeera.com' },
  { name: 'France24', url: 'https://www.france24.com/en/rss', source: 'france24.com' },
  { name: 'SCMP', url: 'http://www.scmp.com/rss/91/feed/', source: 'scmp.com' },
  { name: 'Asia Times', url: 'https://asiatimes.com/feed/', source: 'asiatimes.com' },
  { name: 'The Diplomat', url: 'https://thediplomat.com/feed/', source: 'thediplomat.com' },
  { name: 'Dawn', url: 'https://www.dawn.com/feeds/home', source: 'dawn.com' },
  { name: 'Japan Times', url: 'https://www.japantimes.co.jp/feed/', source: 'japantimes.co.jp' },

  // --- Americas ---
  { name: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml', source: 'npr.org' },
  { name: 'CBC World', url: 'https://rss.cbc.ca/lineup/world.xml', source: 'cbc.ca' },

  // --- Europe (moved from Brave Search) ---
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', source: 'theguardian.com' },
  { name: 'DW English', url: 'https://rss.dw.com/rdf/rss-en-all', source: 'dw.com' },
  { name: 'EuroNews', url: 'https://www.euronews.com/rss', source: 'euronews.com' },

  // --- Africa ---
  { name: 'AllAfrica', url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', source: 'allafrica.com' },
  { name: 'Daily Maverick', url: 'https://www.dailymaverick.co.za/dmrss/', source: 'dailymaverick.co.za' },
  { name: 'The East African', url: 'https://www.theeastafrican.co.ke/rss.xml', source: 'theeastafrican.co.ke' },

  // --- Middle East (Al-Monitor moved from Brave Search) ---
  { name: 'Middle East Eye', url: 'https://www.middleeasteye.net/rss', source: 'middleeasteye.net' },
  { name: 'Al-Monitor', url: 'https://www.al-monitor.com/rss', source: 'al-monitor.com' },

  // --- Asia additions ---
  { name: 'CNA', url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml', source: 'channelnewsasia.com' },
  { name: 'Nikkei Asia', url: 'https://asia.nikkei.com/rss/feed/nar', source: 'asia.nikkei.com' },
  { name: 'Bangkok Post', url: 'https://www.bangkokpost.com/rss/data/most-recent.xml', source: 'bangkokpost.com' },

  // --- Oceania ---
  { name: 'ABC Australia', url: 'https://www.abc.net.au/news/feed/2942460/rss.xml', source: 'abc.net.au' },

  // --- Climate & Environment ---
  { name: 'Inside Climate News', url: 'https://insideclimatenews.org/feed/', source: 'insideclimatenews.org' },
  { name: 'Grist', url: 'https://grist.org/feed/', source: 'grist.org' },

  // --- Technology & Science ---
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', source: 'arstechnica.com' },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', source: 'technologyreview.com' },
];

function createStableTopicId(rawTitle, index) {
  const base =
    typeof rawTitle === 'string' && rawTitle.trim().length
      ? rawTitle.trim()
      : `Topic ${index + 1}`;
  const normalized = base.replace(/\s+/g, ' ').trim();
  return `${normalized}-${index}`;
}

function extractJson(text) {
  try { return JSON.parse(text); } catch (_) { }
  const fenceMatch = text.match(/```json([\s\S]*?)```/i);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    try { return JSON.parse(inner); } catch (_) { }
  }
  const startArr = text.indexOf('[');
  const endArr = text.lastIndexOf(']');
  if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
    const arrStr = text.slice(startArr, endArr + 1);
    try { return JSON.parse(arrStr); } catch (_) { }
  }
  const startObj = text.indexOf('{');
  const endObj = text.lastIndexOf('}');
  if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
    const objStr = text.slice(startObj, endObj + 1);
    try { return JSON.parse(objStr); } catch (_) { }
  }
  // Last resort: the model output was truncated mid-stream (json_object +
  // max_tokens cutoff), so the trailing object/array bracket never arrived and
  // every parse above fails. Salvage every COMPLETE topic object up to the cut.
  const salvaged = salvageTruncatedTopics(text);
  if (salvaged && salvaged.topics.length) {
    console.warn(`extractJson: salvaged ${salvaged.topics.length} topics from truncated output`);
    return salvaged;
  }
  throw new Error('Failed to parse JSON from model output');
}

// Walk the `"topics": [ ... ]` array and collect only fully-closed objects,
// stopping at the first incomplete one. Handles strings/escapes so braces
// inside values don't confuse depth tracking. Returns null if nothing usable.
function salvageTruncatedTopics(text) {
  const keyIdx = text.indexOf('"topics"');
  const arrStart = text.indexOf('[', keyIdx === -1 ? 0 : keyIdx);
  if (arrStart === -1) return null;
  const items = [];
  let i = arrStart + 1;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i++;
    if (i >= text.length || text[i] === ']') break;
    if (text[i] !== '{') break;
    let depth = 0, inStr = false, esc = false, j = i, closed = false;
    for (; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { j++; closed = true; break; } }
    }
    if (!closed) break;
    try { items.push(JSON.parse(text.slice(i, j))); } catch (_) { break; }
    i = j;
  }
  return items.length ? { topics: items } : null;
}

// Source URLs are compared after one pass of HTML-entity decoding and a trim, on both sides: the model
// sometimes turns `&amp;` into `&` (or the reverse), and feeds carry either form.
function normalizeSourceUrl(u) {
  return String(u || '')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
      const k = e.toLowerCase();
      if (k === 'amp') return '&';
      if (k === 'lt') return '<';
      if (k === 'gt') return '>';
      if (k === 'quot') return '"';
      if (k === 'apos') return "'";
      const n = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    })
    .trim();
}

// The same checks for every model reply, whole or salvaged from a truncated one: the category must be
// allowed (aliases mapped) and the topic needs a source. Pure; the handler passes topics that already
// carry validated sources.
function filterTopics(topics) {
  const kept = [];
  for (const t of topics) {
    const alias = CATEGORY_ALIASES[t.category];
    const category = alias || t.category;
    if (alias) console.warn(`CATEGORY MAPPED: "${t.category}" -> "${alias}" for: ${t.title?.substring(0, 40)}`);
    if (!VALID_CATEGORIES.includes(category)) {
      console.warn(`FILTERED: Invalid category "${t.category}" for: ${t.title?.substring(0, 40)}`);
      continue;
    }
    if (!(t.sources?.length > 0)) {
      console.warn(`FILTERED: No sources for: ${t.title?.substring(0, 40)}`);
      continue;
    }
    kept.push(category === t.category ? t : { ...t, category });
  }
  return kept;
}

// The model can overshoot the limit (a truncated reply once salvaged 30 topics against 13): keep the
// first `limit`, in the model's order.
function capTopics(topics, limit) {
  if (topics.length <= limit) return topics;
  console.warn(`TOPIC LIMIT: kept the first ${limit} of ${topics.length} topics`);
  return topics.slice(0, limit);
}

function parseAgeToHours(ageStr) {
  if (!ageStr || typeof ageStr !== 'string') return null;
  const lower = ageStr.toLowerCase().trim();
  const hourMatch = lower.match(/(\d+)\s*hour/);
  if (hourMatch) return parseInt(hourMatch[1], 10);
  const dayMatch = lower.match(/(\d+)\s*day/);
  if (dayMatch) return parseInt(dayMatch[1], 10) * 24;
  const minMatch = lower.match(/(\d+)\s*min/);
  if (minMatch) return parseInt(minMatch[1], 10) / 60;
  return null;
}

function shouldFilterArticle(article) {
  const BLOCKED_DOMAINS = ['archive.is', 'archive.ph', 'web.archive.org', 'archive.org'];
  const MAX_AGE_HOURS = 48;
  const url = article.url || '';
  for (const domain of BLOCKED_DOMAINS) {
    if (url.includes(domain)) {
      return true;
    }
  }
  const ageHours = parseAgeToHours(article.age);
  if (ageHours !== null && ageHours > MAX_AGE_HOURS) {
    return true;
  }
  return false;
}

// The rules part of the selection prompt: who uses the topics, the three kinds of event that get in, each rule with its reason, then the
// stories we follow (decision 0062 rules; story-kinds plan 2026-11-18). `stories` = followedStories(...).stories.
function selectionRules(limit, stories = []) {
  return [
    'HOW YOUR TOPICS ARE USED: each topic becomes one entry on a story page in a record that readers follow over days and weeks. A story is a line of entries about one situation. A reader sees each entry\'s title and a short summary, never these articles. So the first question for every event is: does it START a story, or MOVE a story we already follow? The list STORIES WE FOLLOW below holds every story with an entry in the last 14 days, newest first.',
    '',
    'WHAT GETS IN (three kinds; nothing else):',
    'A. A start: an event that opens a new story readers will want to follow because more will come of it: a war, a crisis, a negotiation, an investigation, a disaster and its aftermath, a policy that takes effect in steps. Leave "follows" out.',
    'B. A move: something DONE in a story we follow, even a quiet step: a vote held, a ruling issued, troops moved, a deal signed, talks held. Set "follows" to that story\'s number. A move is a new development: an article that only retells what the story\'s latest entry says is not a move.',
    'C. A measured change: an official figure (a statistics office, central bank, UN agency or government data release) or a major published study, when the change it reports is large by the source\'s own account (a record, the biggest change in years, a figure crossing an official threshold), or when it feeds a story we follow (then set "follows" too). Set event_type to "measure". An opinion piece, a forecast, a poll, a commentary or one expert\'s view is never a measured change.',
    'Leave out an event that connects to nothing before or after it: a one-off with no story behind it and nothing likely to follow, such as a single crime or a criminal case against a private person (a case against an office-holder or a political figure is not a one-off), a minor accident, a one-day stunt, a celebrity or entertainment announcement, or one expert\'s opinion. A reader cannot follow it, so it does not belong in the record.',
    '',
    'RULES, WITH THE REASON FOR EACH:',
    '1. One event per topic. A page that joins two events cannot be followed over time: later news about one of them has nowhere clean to go, and the other one rides along. If a title needs "and", "as", "while" or a semicolon to hold two events, make two topics or keep only the more significant one. The same cost runs the other way: articles about the SAME event, whatever their headlines, angles or names for the actors, go into ONE topic, or the record gets two pages for one story. Err on the side of merging same-event articles, never of joining different events.',
    '   - Avoid: "Istanbul Hit by Heaviest Rainfall in 84 Years; Pope Leo to Undergo Lung Surgery" (two events: make two topics)',
    '   - Good: "Istanbul Hit by Heaviest Rainfall in 84 Years, Two Dead"',
    '2. Title only what the articles state. Readers take a title as reported fact, so EVERY figure, date, death toll or superlative ("record", "first ever", "since YYYY") in it must appear verbatim in a source article above. A grounded vague title beats a specific invented one. Build each title from its own source articles only: words from a listed story line or from another topic do not belong in it.',
    '3. Sources come only from the list above, with the URL copied exactly: an invented URL is a dead link on a public page. Each article URL goes in exactly ONE topic, so no article supports two pages. Within that, list every article that reports the topic\'s event, not only the best one: readers judge a story by how many outlets confirm it, and an article left out of its own topic supports no page at all.',
    '4. Select what was DONE, not what was said. A statement, plan, warning, call, claim, reaction, threat, pledge, poll or anniversary is not an event (judge by the headline\'s main clause: "X blasts Y as strikes kill 78" is said), because readers can find statements anywhere and the record exists for what happened. Write the title about the event and put a speaker in it only when the statement is itself the act: a declaration of war, a formal resignation, a signed decree. This holds for moves too: a reaction, warning or claim in a story we follow is not a move, however quiet the story has been.',
    '   - Avoid: "UN official warns Ukraine faces its toughest winter"',
    '   - Good: "Prime Minister resigns after losing confidence vote"',
    `5. Significance floor, not a quota. A topic costs a reader's attention, so select EVERY event that clears the floor, then fill remaining slots by significance. The limit is ${limit} topics in total and it is a hard cap: the record keeps the first ${limit} of your list and discards the rest unread, so a ${limit + 1}th topic is lost, and the one lost is the last you wrote, not the least significant. Count your topics before you answer, and if there are more than ${limit}, remove the least significant yourself. Write the list in order of significance, every event that clears the floor first, so that a list that runs long loses only the least significant event. A quiet move (a step in a followed story that does not itself clear the floor) never takes the place of an event that clears the floor: when the list is full, the quiet move is the one left out, and one story never gets two quiet moves while an event that clears the floor is left out. No category minimums, no category cap. The floor: (a) 10 or more deaths, or 100 or more injured or displaced; (b) a decision by a head of state or government, or by a parliament; (c) a nationally significant court ruling; (d) a border or diplomatic act: treaty, sanction, expulsion, recognition; (e) a strike or attack on infrastructure; (f) a disaster declaration. A single source is enough. Beyond the floor, prefer material impact on how people live, work, eat, move or breathe over political theater. An event that clears the floor always gets in: it starts a story or moves one. Fewer than ${limit} is correct when fewer events matter or few are of the three kinds: never fill the list with one-offs or statements to reach ${limit}.`,
    '6. Name a followed story only by its number, copied exactly as listed (for example "S12"). Name one only when the event is plainly part of that story; when unsure, leave "follows" out and the topic starts a story. A wrong number puts the event on the wrong page. When several listed stories cover the same situation, name the one with the most entries, even when another story\'s newest title matches the event more closely. The same situation means the same line of events (the same talks, the same campaign, the same scandal), not the same country or war: a military strike is not part of a peace-talks story, and a sanction or another summit is not part of a trip story.',
    '',
    'TITLE EXAMPLES (specific, one event each):',
    '- "India Heatwave Kills Crops Across Three States as Temperatures Hit 48°C"',
    '- "EU Battery Directive Takes Effect, Forcing Supply Chain Disclosures from 2027"',
    '- "Samsung Announces 25,000 Layoffs as Chip Demand Slump Deepens"',
    '- Too vague: "Middle East Conflict Updates"',
    '- Measured change: "Argentina Inflation Falls to 2.4% Monthly, Lowest Since 2017"',
    '',
    'STORIES WE FOLLOW (number · last entry date · entries in 14 days · newest title; for a story with 2 or more entries, "(began: ...)" is its oldest title in the 14 days):',
    ...(stories.length ? stories.map(followedLine) : ['(none)']),
    '',
  ];
}

// ---- the stories we follow ------------------------------------------------------------------------------------------------------------

/** One list line: `S2 · 2026-11-17 · 3 · <newest title> (began: <oldest title>)`; the began part only when the two titles differ. */
const followedLine = (s) => `${s.key} · ${s.lastDate} · ${s.count} · ${s.title}${s.firstTitle && s.firstTitle !== s.title ? ` (began: ${s.firstTitle})` : ''}`;

const DAY_MS = 24 * 60 * 60 * 1000;
const FOLLOWED_DAYS = 14;  // the list holds every story with an entry today or in the 14 days before
const FOLLOWED_CAP = 350;  // lines; about 314 stories had an entry in 14 days (active.json, 2026-11-18)

/**
 * The stories we follow, from the archive entries ({date, title, threadId, archivedAt?}) of today and the FOLLOWED_DAYS before `nowMs`
 * (UTC days). One line per threadId: a run-local number (S1, S2...), the last entry date, the entries in the window, the newest entry's
 * title and the oldest entry's title (`firstTitle`; the line shows it only when it differs). Stories with 2 or more entries first, then single-entry ones, newest first inside each group; the cap cuts from the end, so the
 * oldest single-entry stories go first. An entry without a threadId or title is not listed. Pure.
 * -> { stories: [{ key, threadId, lastDate, count, title, firstTitle }], cut }.
 */
function followedStories(entries, nowMs) {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const from = new Date(nowMs - FOLLOWED_DAYS * DAY_MS).toISOString().slice(0, 10);
  // an entry's place in time: its day, then its archive time, then its place in the input (the rows are oldest generation first)
  const later = (a, b) => (a.date !== b.date ? a.date > b.date : a.at !== b.at ? a.at > b.at : a.i > b.i);
  const byThread = new Map();
  (entries || []).forEach((e, i) => {
    if (!e || !e.threadId || !e.title || !e.date || e.date < from || e.date > today) return;
    const pos = { date: e.date, at: String(e.archivedAt || ''), i };
    const s = byThread.get(e.threadId);
    if (!s) byThread.set(e.threadId, { threadId: e.threadId, count: 1, title: e.title, pos, firstTitle: e.title, firstPos: pos });
    else {
      s.count += 1;
      if (later(pos, s.pos)) Object.assign(s, { title: e.title, pos });
      if (later(s.firstPos, pos)) Object.assign(s, { firstTitle: e.title, firstPos: pos });
    }
  });
  const all = [...byThread.values()].sort((a, b) => ((b.count >= 2) - (a.count >= 2)) || (later(a.pos, b.pos) ? -1 : later(b.pos, a.pos) ? 1 : 0));
  const stories = all.slice(0, FOLLOWED_CAP).map((s, n) => ({ key: `S${n + 1}`, threadId: s.threadId, lastDate: s.pos.date, count: s.count, title: s.title, firstTitle: s.firstTitle }));
  const cut = all.length - stories.length;
  console.log(`FOLLOWED: ${stories.length} stories listed, ${cut} cut`);
  return { stories, cut };
}

// The selection prompt for one run. Pure: all inputs are arguments, so tests can read the text. `stories` = followedStories(...).stories.
function buildSelectionPrompt({ articles, limit, stories = [] }) {
  const articlesText = articles
    .map((a, i) => `${i + 1}. ${a.title}\n   Source: ${a.source}\n   Published: ${a.age}\n   URL: ${a.url}\n   ${a.description}`)
    .join('\n\n');

  return [
    'You are the editor of a record of world news stories. Read the articles below and pick the events that start a story or move a story we follow.',
    '',
    '=== NEWS ARTICLES ===',
    articlesText,
    '=== END OF ARTICLES ===',
    '',
    `Task: pick up to ${limit} events of the three kinds described below. Return a JSON object with a single key "topics" containing an array of topic objects.`,
    '',
    'ALLOWED CATEGORIES (use ONLY these):',
    '- politics (elections, policy changes, diplomatic relations, government actions)',
    '- economy (macroeconomics, trade deals, sanctions, currency, central bank policy)',
    '- military (defense spending, troop movements, arms deals, military exercises)',
    '- conflict (wars, battles, peace talks, territorial disputes, organized violence)',
    '- disaster (natural disasters, industrial accidents, humanitarian crises)',
    '- technology (tech breakthroughs, AI, cybersecurity, major platform/product news)',
    '- health (disease outbreaks, epidemics, pandemics, major drug approvals, healthcare policy)',
    '- climate (climate impacts, emissions data, extreme weather attribution, climate policy, environmental treaties)',
    '- science (research breakthroughs, space, biology, physics, geology, published findings with global implications)',
    '- business (corporate M&A, major layoffs, supply chain disruptions, major industry shifts, labor disputes)',
    '- society (migration, demographics, social movements, protests, education, human rights, inequality)',
    '- energy (oil, gas, renewables, grid infrastructure, energy security, transition policy)',
    '',
    'REJECT these categories: entertainment, sports, celebrity, lifestyle',
    '',
    ...selectionRules(limit, stories),
    'REGIONAL DIVERSITY (soft note):',
    '- Among events of similar significance, prefer a spread across Americas, Europe, Asia, Middle East, Africa',
    '- Do NOT let one story dominate all topics',
    '- Never skip an event that clears the floor to improve the spread, and never pad with weak items to cover a region',
    '',
    'Each topic object MUST have:',
    '- title: string (SPECIFIC event with key details)',
    '- category: string (one of the 12 allowed categories)',
    '- search_keywords: array of 3-6 keywords',
    '- regions: array of country names involved',
    '- sources: array of source objects (each with {title, url, source, age, snippet, tier}) where tier is "primary" (article is directly about this event) or "secondary" (related/background)',
    '- x_trending: boolean (true if trending on X)',
    '- significance: string ("high", "medium", or "low")',
    '- urgency: string ("high" = breaking/escalating in last 24h, "medium" = developing story, "low" = background/slow-moving)',
    '- urgencyReason: string (one sentence explaining the urgency classification)',
    '- primaryCountry: string (the single country most central to this event — the anchor)',
    '- mentionedCountries: array of other country names materially involved (not just mentioned in passing)',
    '- follows: string (optional) — the number of the followed story this topic moves, exactly as listed (e.g. "S12"); leave it out for a start',
    '- iso3: array of 1-4 ISO 3166-1 alpha-3 country codes for the countries involved (e.g. ["USA","IRN"])',
    '- actors: array of 1-3 SPECIFIC named people or organizations central to the event (e.g. ["Donald Trump","IAEA"]) — full proper names; NEVER a country, city, or place (those belong in iso3/regions)',
    '- event_type: string, exactly one of: war, unrest, diplomacy, election, policy, economy, markets, disaster, health, tech, measure, other ("measure" only for a measured change, kind C)',
  ].join('\n');
}


// ============================================================
// THE SELECTION STEPS the handler runs around its one model call, as functions of their inputs (no AWS, no clock of their own: `nowMs`
// is an argument), so the one-off recovery script (backend/record/cli/recover-late-slots.mjs) runs exactly these for a missed slot.
// ============================================================

const SEEN_TOPICS_TTL_HOURS = 24;

/** The articles with a url, the first of each url kept (the run's one list; also the pool the source urls are validated against). */
function dedupeByUrl(articles) {
  const seen = new Set();
  return articles.filter((article) => {
    if (!article.url || seen.has(article.url)) return false;
    seen.add(article.url);
    return true;
  });
}

/** The seen-today entries still inside the 24 h window at `nowMs`. */
function freshSeen(entries, nowMs) {
  const cutoff = nowMs - (SEEN_TOPICS_TTL_HOURS * 60 * 60 * 1000);
  return entries.filter((e) => e.seenAt > cutoff);
}

/** The seen-today list after a run: the earlier entries whose fingerprint this run did not write again, then this run's topics. */
function nextSeenEntries(seenEntries, topics, nowMs) {
  const newEntries = topics.map((t) => ({ fingerprint: slugifyTitle(t.title), title: t.title, seenAt: nowMs }));
  const newFingerprints = new Set(newEntries.map((e) => e.fingerprint));
  return [...seenEntries.filter((e) => !newFingerprints.has(e.fingerprint)), ...newEntries];
}

/**
 * The prompt of one run from the fetched pool: one prompt row per event (same-event collapse), the newest PROMPT_POOL_PER_FEED per feed. The full
 * pool stays with the caller for URL validation and source enrichment. With no article at all: the "X trends" fallback prompt.
 * -> { prompt, collapsed, promptCount }.
 */
function selectionRequest({ articles, limit, stories = [] }) {
  if (articles && articles.length > 0) {
    const { items: collapsedArticles, collapsed } = collapseSameEvent(articles);
    const promptArticles = newestPerFeed(collapsedArticles, PROMPT_POOL_PER_FEED);
    console.log(`DEDUPE: ${collapsed} feed items collapsed into the same event; ${promptArticles.length} of ${articles.length} fetched items go to the model (newest ${PROMPT_POOL_PER_FEED} per feed)`);
    return { prompt: buildSelectionPrompt({ articles: promptArticles, limit, stories }), collapsed, promptCount: promptArticles.length };
  }
  console.warn('No articles available, falling back to Grok X-knowledge mode');
  const prompt = [
    'You are a news analyst with real-time access to X (Twitter) trends.',
    'Since no news articles are available, use your knowledge of what is trending on X today.',
    '',
    'Return a JSON object with a single key "topics" containing an array of topic objects.',
    '',
    'ALLOWED CATEGORIES: politics, economy, military, conflict, disaster, technology, health, climate, science, business, society, energy',
    'REJECT: entertainment, sports, celebrity, lifestyle',
    'SELECTION: choose events by significance, not to fill categories; no category minimums or caps.',
    '',
    'Each topic must have: title, category, search_keywords, regions, x_trending, significance, urgency ("high"/"medium"/"low"), urgencyReason (one sentence), primaryCountry (single anchor country), mentionedCountries (array)',
    '',
    `Return up to ${limit} items; fewer is correct when fewer events matter.`,
  ].join('\n');
  return { prompt, collapsed: 0, promptCount: 0 };
}

/** The options of the selection call (shared llm.js chat, thinking off). Timeout + 2 transport retries match the OpenAI SDK defaults this replaced. */
function selectionChatOptions({ prompt, model }) {
  return {
    step: 'topic_selection',
    model,
    system: 'You are a news analyst that returns only valid JSON. No commentary or markdown.',
    user: prompt,
    json: true,
    temperature: 0.5,
    // 16000 (story-kinds plan 2026-11-18): answers reached 10,800 tokens live and 11,098 in testing under the old 12000, and a cut
    // reply loses its last topics. The cap costs nothing unless used.
    maxTokens: 16000,
    timeoutMs: 600000,
    retries: 2,
  };
}

// Phase 1b event-fingerprint vocabulary (shared with the map classifier's event types), plus `measure`: a measured change (an official
// figure or a major study), the picking rules' kind C.
const EVENT_TYPES = new Set(['war', 'unrest', 'diplomacy', 'election', 'policy', 'economy', 'markets', 'disaster', 'health', 'tech', 'measure', 'other']);

/**
 * The model's answer -> the run's topics: parse, validate the source urls against the pool, build each topic with its event fingerprint,
 * map its `follows` number to the followed story (`continues_thread` = the story's thread id, `continues_topic` = its listed title),
 * enrich the sources from the pool, filter the category, drop repeats of the last 24 h, cap to `limit`. `env` carries the SOURCE_ENRICH_* switches.
 * `stories` = the list the prompt carried (followedStories(...).stories); `archiveEntries` = the archive entries ({date, title}) it was built from.
 * -> { topics, normalizedCount } (normalizedCount = topics before the filters).
 */
function processSelection({ text, articles: allArticles, seenEntries = [], archiveEntries = [], stories = [], limit, nowMs, env = process.env }) {
  const parsed = extractJson(text);
  const topics = Array.isArray(parsed) ? parsed : (parsed?.topics || []);

  // SOURCE VALIDATION: Filter out hallucinated URLs
  // normalised URL -> the pool's own URL, so a decoded/encoded variant still validates and the kept source carries the real one
  const validUrls = new Map(allArticles.map(a => [normalizeSourceUrl(a.url), a.url]));
  let totalSourcesBefore = 0;
  let totalSourcesAfter = 0;
  const storyByKey = new Map(stories.map((s) => [s.key, s]));

  const normalized = topics.map((t, idx) => {
    const title = String(t?.title || '').trim();
    const topicId = createStableTopicId(title, idx);
    const rawSources = Array.isArray(t?.sources) ? t.sources : [];
    totalSourcesBefore += rawSources.length;

    const validatedSources = rawSources.filter(s => {
      if (!s?.url) return false;
      const poolUrl = validUrls.get(normalizeSourceUrl(s.url));
      if (!poolUrl) {
        console.warn(`HALLUCINATION: Filtering fabricated URL: ${s.url?.substring(0, 60)}`);
        return false;
      }
      s.url = poolUrl;
      return true;
    });
    totalSourcesAfter += validatedSources.length;

    // the followed story this topic moves: only a listed number counts; the model never names a title itself
    const follows = t?.follows == null ? '' : String(t.follows).trim();
    const story = follows ? storyByKey.get(follows.toUpperCase()) : undefined;
    if (follows && !story) console.warn(`FOLLOWS: unknown "${follows.substring(0, 20)}" for: ${title.substring(0, 40)}`);

    const urgency = ['high', 'medium', 'low'].includes(String(t?.urgency || '').toLowerCase())
      ? String(t.urgency).toLowerCase()
      : 'medium';

    // Phase 1b — event fingerprint (additive; validated, never trusts raw LLM output).
    const iso3 = canonicalIso3(t?.iso3);
    const countryNames = new Set([
      ...(Array.isArray(t?.regions) ? t.regions : []),
      t?.primaryCountry,
      ...(Array.isArray(t?.mentionedCountries) ? t.mentionedCountries : []),
    ].filter(Boolean).map(c => String(c).toLowerCase().trim()));
    const actors = (Array.isArray(t?.actors) ? t.actors : [])
      .map(a => String(a).trim())
      .filter(a => a && a.length <= 60 && !countryNames.has(a.toLowerCase())).slice(0, 3);
    const eventType = EVENT_TYPES.has(String(t?.event_type || '').toLowerCase())
      ? String(t.event_type).toLowerCase() : 'other';

    return {
      id: topicId,
      topicId,
      title,
      category: String(t?.category || '').trim().toLowerCase(),
      search_keywords: Array.isArray(t?.search_keywords) ? t.search_keywords.map(k => String(k)) : [],
      regions: Array.isArray(t?.regions) ? t.regions.map(r => String(r)) : [],
      iso3,
      actors,
      event_type: eventType,
      sources: validatedSources.map(s => ({
        ...sourceWithPublication(s, allArticles),
        tier: s.tier === 'secondary' ? 'secondary' : 'primary',
      })),
      x_trending: Boolean(t?.x_trending),
      significance: String(t?.significance || 'medium').toLowerCase(),
      urgency,
      ...(t?.urgencyReason && { urgencyReason: String(t.urgencyReason) }),
      ...(t?.primaryCountry && { primaryCountry: String(t.primaryCountry) }),
      ...(Array.isArray(t?.mentionedCountries) && t.mentionedCountries.length > 0 && {
        mentionedCountries: t.mentionedCountries.map(c => String(c)),
      }),
      ...(story && { continues_thread: story.threadId, continues_topic: story.title }),
    };
  });

  const filteredOut = totalSourcesBefore - totalSourcesAfter;
  if (filteredOut > 0) {
    console.warn(`SOURCE VALIDATION: Filtered ${filteredOut} hallucinated sources`);
  }

  // SOURCE ENRICHMENT: post-LLM Jaccard match against the full article pool.
  // Re-attaches matching articles the LLM dropped due to its "one article per
  // topic" exclusivity rule + output-token economy. See SOURCE_DIVERSITY_PLAN.md.
  // Wrapped in try/catch so a bug here never blocks topic publishing.
  try {
    if (String(env.SOURCE_ENRICH_ENABLED || 'true').toLowerCase() !== 'false') {
      const threshold = Number(env.SOURCE_ENRICH_THRESHOLD) || 0.20;
      const maxEnriched = Number(env.SOURCE_ENRICH_MAX) || 12;
      const allowCrossTopic = String(env.SOURCE_ENRICH_CROSS_TOPIC || 'false').toLowerCase() === 'true';
      const stats = applyEnrichment(normalized, allArticles, {
        threshold, maxEnriched, allowCrossTopic,
      });
      console.log(`SOURCE ENRICHMENT: ${stats.sourcesBefore} → ${stats.sourcesAfter} sources (+${stats.gainedSources}), ${stats.outletsBefore} → ${stats.outletsAfter} outlets (+${stats.gainedOutlets}); threshold=${threshold} max=${maxEnriched}`);
    } else {
      console.log('SOURCE ENRICHMENT: disabled via SOURCE_ENRICH_ENABLED=false');
    }
    annotateSourcesWithMetadata(normalized);
  } catch (err) {
    console.error('SOURCE ENRICHMENT failed (continuing with LLM-only sources):', err);
  }

  // TOPIC FILTERING: category (aliases mapped) + sources; the limit is applied after the dedupe below
  let filtered = filterTopics(normalized);

  // DEDUPE (code, not prompt): drop a topic that repeats an entry of the last 24h runs, today or yesterday,
  // unless its title carries a number the earlier title lacks.
  const yesterday = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const earlierTitles = [
    ...seenEntries.map(e => e.title),
    ...archiveEntries.filter(e => e.date >= yesterday).map(e => e.title),
  ];
  const repeats = dropRepeatTopics(filtered, earlierTitles);
  const keyByThread = new Map(stories.map((s) => [s.threadId, s.key]));
  for (const d of repeats.dropped) {
    const key = keyByThread.get((filtered.find((t) => t.title === d.title) || {}).continues_thread);
    console.warn(`DEDUPE: dropped repeat "${d.title?.substring(0, 60)}"${key ? ` [follows ${key}]` : ''} (repeats "${d.repeats?.substring(0, 60)}")`);
  }
  filtered = repeats.topics;
  filtered = capTopics(filtered, limit);

  console.log(`TOPIC FILTER: ${filtered.length} topics passed (${normalized.length - filtered.length} filtered)`);

  // Log final summary
  console.log('Final topics:', JSON.stringify(filtered.map(t => ({
    title: t.title?.substring(0, 40),
    category: t.category,
    sources: t.sources?.length || 0,
  })), null, 2));

  return { topics: filtered, normalizedCount: normalized.length, droppedRepeats: repeats.dropped, sourcesFiltered: filteredOut };
}

module.exports = {
  VALID_CATEGORIES, CATEGORY_ALIASES, FEED_FETCH_CAP, PROMPT_POOL_PER_FEED, RSS_FEEDS, SEEN_TOPICS_TTL_HOURS,
  canonicalIso3, slugifyTitle, createStableTopicId, extractJson, normalizeSourceUrl, filterTopics, capTopics,
  parseAgeToHours, shouldFilterArticle, buildSelectionPrompt, dedupeByUrl, freshSeen, nextSeenEntries,
  FOLLOWED_DAYS, FOLLOWED_CAP, followedStories, selectionRules, selectionRequest, selectionChatOptions, processSelection,
};
