#!/usr/bin/env node
// Operator script (0039 alias rule layer 2, 0040 rule 4): propose Wikidata ids for the most-cited actors. No model.
// Never writes record/operator/aliases.json (operator-owned); it writes proposals the operator copies from.
//
//   node reconcile-actors.mjs [--live | --input FILE] [--top 100 | --all] [--cache FILE] [--aliases FILE] [--out DIR] [--write]
//
//   --live         read record/views/index/active.json from the world bucket (read-only `aws s3 cp`, ap-northeast-1)
//   --input FILE   a local active.json (stories[].actorIds), a {id: count} map, or a JSON array of ids
//   --aliases FILE the operator aliases.json (local copy); ids it already maps or pins are skipped
//   --cache FILE   remember Wikidata answers so a rerun or a crash costs no requests
//   --write        write aliases.candidate.json, review.md, aliases.proposals.json, generic.candidates.json, unresolved.json, summary.json into --out; without it
//                  nothing is written and the summary is printed (dry run)
// Wikidata wbsearchentities: at most 1 request/second, polite User-Agent, one request per name.
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const BUCKET = 'globalperspective-world-280362093938';
const UA = 'GlobalPerspectivesReconcile/1.0 (https://globalperspective.net; benlai310@gmail.com)';
const API = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_ID = /^Q[1-9][0-9]*$/;

// Plural nouns that name a crowd, not an entity. A name is generic when it is exactly one of GENERIC_NAMES, or its last word is a GENERIC_NOUN.
const GENERIC_NAMES = new Set(['the government', 'government', 'government officials', 'officials', 'authorities', 'the authorities', 'the public', 'the opposition', 'opposition', 'police', 'security forces', 'the military', 'the army']);
const GENERIC_NOUNS = new Set(['protesters', 'protestors', 'demonstrators', 'students', 'civilians', 'residents', 'voters', 'settlers', 'migrants', 'refugees', 'officials', 'soldiers', 'rebels', 'militants', 'pirates', 'workers', 'farmers', 'lawmakers', 'critics', 'activists', 'residents', 'citizens', 'people', 'fans', 'investors', 'traders', 'teachers', 'doctors', 'prisoners', 'hostages', 'victims']);

// Description classes (Wikidata descriptions are short English phrases): a hit is acceptable only when its description names one.
const CLASSES = [
  ['human', /\b(politician|president|prime minister|minister|chancellor|monarch|king|queen|emperor|pope|bishop|leader|head of state|head of government|governor|mayor|senator|diplomat|ambassador|general|admiral|officer|commander|activist|journalist|lawyer|judge|economist|businessperson|businessman|businesswoman|entrepreneur|billionaire|investor|executive|ceo|chief|spokesperson|official|scientist|physician|professor|writer|actor|actress|singer|footballer|athlete|player|coach|astronaut|philanthropist|revolutionary|dissident|militant|cleric|ayatollah|imam|sultan|emir|prince|princess|chairman|chairwoman|speaker|secretary|attorney|prosecutor|politicia)\b/],
  ['organization', /\b(organi[sz]ation|company|corporation|agency|institution|association|union|alliance|bank|party|council|committee|commission|court|army|armed forces|military|navy|air force|police|ministry|department|government|parliament|congress|senate|assembly|movement|group|coalition|network|foundation|university|newspaper|broadcaster|network|cartel|militia|brigade|front|force|forces|treaty organi[sz]ation|intergovernmental|non-governmental|ngo|bureau|service|authority|administration|cabinet|executive branch|legislature|judiciary|intelligence|programme|program|news channel|broadcaster|airline|enterprise|firm)\b/],
  ['political party', /\bpolitical party\b/],
  ['armed group', /\b(armed group|rebel group|militant|paramilitary|terrorist|insurgent|militia|guerrilla|rebel)\b/],
  ['government agency', /\b(government agency|federal agency|executive department|ministry|government department|intelligence agency|regulatory)\b/],
  ['office', /\b(position|office|post|title|role)\b/],
  ['country/region', /\b(country|sovereign state|state in|republic|kingdom|territory|region|province|federal state|autonomous|continent|supranational|union of)\b/],
];
// Never an entity we mean, whatever else the description says.
const REJECT = /\b(wikimedia|wikinews|disambiguation|news article|episode|album|song|film|television|tv series|scientific article|scholarly|paper|novel|video game|musical|band|train|railway|surname|given name|family name|website|district of|inner city|neighbou?rhood|sanatorium|asteroid|species|genus)\b/;

export const nameOf = (id) => String(id).replace(/^name:/, '');
const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function isGenericName(name) {
  const n = fold(name);
  if (GENERIC_NAMES.has(n)) return true;
  const last = n.split(' ').pop();
  return GENERIC_NOUNS.has(last);
}

export function classOf(description) {
  const d = String(description || '').toLowerCase();
  if (!d || REJECT.test(d)) return null;
  for (const [cls, re] of CLASSES) if (re.test(d)) return cls;
  return null;
}

// ---- name comparison: word order, "of"/"the", demonyms and "military" are not differences ----
const DEMONYMS = {korean: 'korea', ukrainian: 'ukraine', russian: 'russia', chinese: 'china', iranian: 'iran', israeli: 'israel', american: 'united states', british: 'united kingdom', french: 'france', german: 'germany',
  japanese: 'japan', indian: 'india', pakistani: 'pakistan', turkish: 'turkey', syrian: 'syria', iraqi: 'iraq', lebanese: 'lebanon', egyptian: 'egypt', saudi: 'saudi arabia', yemeni: 'yemen', afghan: 'afghanistan',
  taiwanese: 'taiwan', philippine: 'philippines', filipino: 'philippines', indonesian: 'indonesia', thai: 'thailand', vietnamese: 'vietnam', burmese: 'myanmar', bangladeshi: 'bangladesh', nepali: 'nepal',
  brazilian: 'brazil', argentine: 'argentina', mexican: 'mexico', venezuelan: 'venezuela', colombian: 'colombia', peruvian: 'peru', chilean: 'chile', cuban: 'cuba', canadian: 'canada', australian: 'australia',
  italian: 'italy', spanish: 'spain', polish: 'poland', dutch: 'netherlands', belgian: 'belgium', swedish: 'sweden', norwegian: 'norway', danish: 'denmark', finnish: 'finland', greek: 'greece', hungarian: 'hungary',
  serbian: 'serbia', georgian: 'georgia', armenian: 'armenia', azerbaijani: 'azerbaijan', kazakh: 'kazakhstan', nigerian: 'nigeria', ethiopian: 'ethiopia', kenyan: 'kenya', sudanese: 'sudan', somali: 'somalia',
  libyan: 'libya', tunisian: 'tunisia', algerian: 'algeria', moroccan: 'morocco', congolese: 'congo', ugandan: 'uganda', ghanaian: 'ghana', palestinian: 'palestine', jordanian: 'jordan', qatari: 'qatar', emirati: 'united arab emirates'};
const STOP = new Set(['of', 'the', 'and', 'in', 'a']);
const ORG_NOUNS = {government: 'Government', military: 'Armed Forces', army: 'Armed Forces', parliament: 'Parliament', police: 'Police', president: 'President', 'prime minister': 'Prime Minister', 'foreign ministry': 'Ministry of Foreign Affairs', 'defense ministry': 'Ministry of Defense', 'central bank': 'Central Bank'};

/** A comparable key: folded, demonyms to their country, "military" to "armed forces", stop words dropped, words sorted. */
export function canonKey(s) {
  const out = [];
  for (const w of fold(s).split(' ').filter(Boolean)) {
    if (STOP.has(w)) continue;
    const t = w === 'military' ? 'armed forces' : w === 'defence' ? 'defense' : (DEMONYMS[w] || w);
    out.push(...t.split(' '));
  }
  return out.sort().join(' ');
}

/** Extra queries for a "<demonym> <org/role>" title: "south korean government" -> "Government of South Korea". */
export function rewrites(name) {
  const ws = fold(name).split(' ');
  const i = ws.findIndex((w) => DEMONYMS[w]);
  if (i < 0) return [];
  const dir = i > 0 && ['north', 'south', 'east', 'west', 'new'].includes(ws[i - 1]) ? ws[i - 1] : null;
  const country = (dir ? `${dir} ` : '') + DEMONYMS[ws[i]];
  const rest = ws.filter((_, j) => j !== i && !(dir && j === i - 1)).join(' ');
  const noun = ORG_NOUNS[rest];
  if (noun) return [`${noun} of ${country}`];
  return rest && rest.split(' ').length <= 2 ? [`${rest} of ${country}`] : [];
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 9;
  let prev = Array.from({length: n + 1}, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// A description that may name a position/office (or a person who holds one: the entity probe tells them apart).
const OFFICEISH = /\b(position|office|post|title|role|head of state|head of government|head of the government)\b|^(the )?(president|prime minister|mayor|governor|minister|chancellor|speaker|secretary|leader|chief|commander)\b/i;
export const isOfficeish = (description) => OFFICEISH.test(String(description || '')) && !REJECT.test(String(description || '').toLowerCase());

/** How a hit's text relates to the actor name: exact | alias | near | null. `texts` = [label, ...matched alias text]. */
export function matchTier(name, hit, {top = true, office = false} = {}) {
  const n = fold(name);
  const type = hit.match && hit.match.type;
  const label = fold(hit.label || ''), matched = fold((hit.match && hit.match.text) || '');
  if (top) {
    if (label === n && (type === 'label' || !type)) return 'exact';
    if (type === 'alias' && matched === n) return 'alias';
    if (type === 'label' && matched === n) return 'exact';
  }
  const texts = [label, type === 'alias' ? matched : ''].filter(Boolean);
  for (const t of texts) {
    if (n.length >= 6 && t.length >= 6 && levenshtein(n, t) <= 2) return 'near';
    if (canonKey(t) === canonKey(n)) return 'near';
    const a = n.split(' '), b = t.split(' ');
    if (a.length >= 2 && b.length >= 2 && a[a.length - 1] === b[b.length - 1] && (levenshtein(a[0], b[0]) <= 2 || a[0][0] === b[0][0] && (a[0].length === 1 || b[0].length === 1))) return 'near';
  }
  if (office) {
    const k = new Set(canonKey(n).split(' ')), lk = canonKey(label).split(' ');
    if (k.size >= 2 && [...k].every((w) => lk.includes(w)) && lk.length <= k.size + 2) return 'near';
  }
  return null;
}

/**
 * The conservative rule: the top hit only; its label equals the name (exact) or it matched an alias that equals the name (alias);
 * and its description names an allowed class. A spelling or word-order variant among the top three hits of the same class is 'near'.
 * Returns {proposal} or {unresolved: reason}. Synchronous: the office-to-holder step lives in resolveActor.
 */
export function accept(id, hits) {
  const name = nameOf(id);
  const list = Array.isArray(hits) ? hits.slice(0, 3) : [];
  if (!list.length) return {unresolved: 'no hit'};
  if (!WIKIDATA_ID.test(list[0].id || '')) return {unresolved: 'no entity id'};
  let why = `top hit "${list[0].label}" does not match`;
  for (let i = 0; i < list.length; i++) {
    const h = list[i];
    if (!WIKIDATA_ID.test(h.id || '')) continue;
    const cls = classOf(h.description);
    const tier = matchTier(name, h, {top: i === 0, office: isOfficeish(h.description)});
    if (!tier) continue;
    if (!cls) { if (i === 0) why = `description "${h.description || ''}" is not an allowed class`; continue; }
    return {proposal: {canonical: id, wikidataId: h.id, label: h.label, description: h.description || '', confidence: tier, via: tier}};
  }
  return {unresolved: why};
}

const day = (t) => (t ? String(t).slice(0, 10) : null);
/** Holders of an office that overlap [from, to] (ISO dates). A holder with no dates counts only when no dated holder overlaps. */
export function holdersInWindow(holders, from, to) {
  const dated = [], undated = [];
  for (const h of holders || []) {
    const s = day(h.start), e = day(h.end);
    if (!s && !e) { undated.push(h); continue; }
    if ((s && to && s > to) || (e && from && e < from)) continue;
    dated.push({...h, start: s, end: e});
  }
  const out = dated.length ? dated : undated;
  const seen = new Set();
  return out.filter((h) => { const k = `${h.id}|${h.start}`; if (seen.has(k)) return false; seen.add(k); return true; }).sort((x, y) => String(x.start || '').localeCompare(String(y.start || '')));
}

/**
 * Resolve one actor: search (plus rewritten queries), accept, and when the match is an office resolve the holder for the actor's window.
 * Returns {proposals: [...]} (several only for an ambiguous period) or {unresolved: reason}.
 */
export async function resolveActor(id, {search, probe, window = {}}) {
  const name = nameOf(id);
  let r = accept(id, await search(name));
  if (!r.proposal) for (const q of rewrites(name)) { const r2 = accept(id, await search(q)); if (r2.proposal) { r = r2; break; } }
  if (!r.proposal) return {unresolved: r.unresolved};
  const p = r.proposal;
  if (!probe || !(isOfficeish(p.description) || classOf(p.description) === 'office')) return {proposals: [p]};
  const info = await probe(p.wikidataId);
  if (!info || info.isHuman || !info.isPosition) return {proposals: [p]};
  const holders = holdersInWindow(info.holders, window.from, window.to);
  const base = {canonical: id, title: p.label, office: p.wikidataId, confidence: p.confidence};
  if (!holders.length) return {proposals: [{...p, via: 'position', position_item: true, title: p.label, office: p.wikidataId}]};
  const mk = (h) => ({...base, wikidataId: h.id, label: h.label, description: h.description || '', via: 'office→holder'});
  if (holders.length === 1) return {proposals: [mk(holders[0])]};
  return {proposals: holders.map((h) => ({...mk(h), ambiguous_period: true, period: {from: h.start || null, to: h.end || null}}))};
}

/** Count stories per actor id (an active.json), or read a {id: count} map / array of ids. Highest first, id as tiebreak. */
export function countActors(data) {
  const counts = new Map();
  const bump = (id, n = 1) => counts.set(id, (counts.get(id) || 0) + n);
  if (data && Array.isArray(data.stories)) for (const s of data.stories) for (const id of new Set(s.actorIds || [])) bump(id);
  else if (Array.isArray(data)) for (const id of data) bump(id);
  else if (data && typeof data === 'object') for (const [id, n] of Object.entries(data)) bump(id, Number(n) || 1);
  return [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

/** Ids the operator file already settles: any canonical, variant or pinned id. */
export function settledIds(operator) {
  const out = new Set();
  for (const a of (operator && Array.isArray(operator.aliases) ? operator.aliases : [])) { if (a && a.canonical) out.add(a.canonical); for (const v of (a && a.variants) || []) out.add(v); }
  return out;
}

/** Per-actor first and last appearance (ISO dates) from an active.json; {} for other input shapes. */
export function actorWindows(data) {
  const w = new Map();
  if (!(data && Array.isArray(data.stories))) return w;
  for (const s of data.stories) {
    const from = day(s.born || s.lastFactAt), to = day(s.lastFactAt || s.born);
    for (const id of new Set(s.actorIds || [])) {
      const cur = w.get(id) || {from, to};
      if (from && (!cur.from || from < cur.from)) cur.from = from;
      if (to && (!cur.to || to > cur.to)) cur.to = to;
      w.set(id, cur);
    }
  }
  return w;
}

/** Run the reconcile over ranked [id, count] pairs. `search(name)` returns the hit list, `probe(qid)` the office info; no network happens here. */
export async function reconcile(ranked, {search, probe = null, windows = new Map(), settled = new Set(), onProgress = () => {}}) {
  const proposals = [], unresolved = [], generic = [], skipped = [];
  for (const [id, count] of ranked) {
    if (!String(id).startsWith('name:') || settled.has(id)) { skipped.push({id, count}); continue; }
    const name = nameOf(id);
    if (isGenericName(name)) { generic.push({canonical: id, count}); continue; }
    const window = windows.get(id) || {};
    let r;
    try { r = await resolveActor(id, {search, probe, window}); } catch (e) { r = {unresolved: `search failed: ${e.message}`}; }
    if (r.proposals) for (const p of r.proposals) proposals.push({...p, count, window}); else unresolved.push({canonical: id, count, reason: r.unresolved});
    onProgress(id, r);
  }
  return {proposals, unresolved, generic, skipped};
}

/** ready: exact, alias, or an office with one holder. check: near, ambiguous_period, position items. */
export function groupOf(p) {
  if (p.ambiguous_period || p.position_item || p.confidence === 'near') return 'check';
  return 'ready';
}

/**
 * The alias-file view of the proposals: spelling variants that resolve to one Wikidata id pool under the commonest name.
 * Ambiguous periods cannot be one alias entry (one canonical, one id); they are listed apart under `ambiguous`.
 */
export function buildAliasFile(result) {
  const byQid = new Map(), ambiguous = [];
  for (const p of result.proposals) {
    if (p.ambiguous_period) { ambiguous.push(p); continue; }
    const g = byQid.get(p.wikidataId) || [];
    g.push(p); byQid.set(p.wikidataId, g);
  }
  const aliases = [];
  for (const [qid, g] of byQid) {
    g.sort((a, b) => b.count - a.count || (a.canonical < b.canonical ? -1 : 1));
    const e = {canonical: g[0].canonical, variants: g.slice(1).map((p) => p.canonical), wikidataId: qid};
    const titles = [...new Set(g.map((p) => p.title).filter(Boolean))];
    if (titles.length) e.title = titles.join(' | ');
    if (g.some((p) => p.position_item)) e.position_item = true;
    aliases.push(e);
  }
  for (const gn of result.generic) aliases.push({canonical: gn.canonical, variants: [], wikidataId: null, generic: true});
  for (const u of result.unresolved) aliases.push({canonical: u.canonical, variants: [], wikidataId: null});
  return {schemaVersion: 1, note: 'Candidate only. Review review.md; the operator copies accepted entries into record/operator/aliases.json. title/position_item/ambiguous are informational.', aliases, ambiguous};
}

/** review.md: one line per entry, grouped ready / check / unresolved / generic. */
export function reviewMarkdown(result) {
  const line = (p) => {
    const tag = p.ambiguous_period ? ` ambiguous_period ${p.period.from || '?'}..${p.period.to || '?'}` : p.position_item ? ' position item, no holder in window' : '';
    return `${p.canonical} ← ${p.pooled && p.pooled.length ? p.pooled.join(', ') : '-'} | ${p.wikidataId} ${p.label} (${p.description})${p.title ? ` [title: ${p.title}]` : ''} | via: ${p.via} | ${p.confidence}${tag}`;
  };
  const pool = new Map();
  for (const p of result.proposals) if (!p.ambiguous_period) { const g = pool.get(p.wikidataId) || []; g.push(p); pool.set(p.wikidataId, g); }
  const lines = {ready: [], check: []};
  const done = new Set();
  for (const p of result.proposals) {
    if (p.ambiguous_period) { lines.check.push(line(p)); continue; }
    if (done.has(p.wikidataId)) continue;
    done.add(p.wikidataId);
    const g = pool.get(p.wikidataId).slice().sort((a, b) => b.count - a.count);
    const grp = g.some((x) => groupOf(x) === 'check') ? 'check' : 'ready';
    lines[grp].push(line({...g[0], pooled: g.slice(1).map((x) => x.canonical), via: [...new Set(g.map((x) => x.via))].join('+'), confidence: [...new Set(g.map((x) => x.confidence))].join('+'), title: [...new Set(g.map((x) => x.title).filter(Boolean))].join(' | ')}));
  }
  const sec = (h, arr) => `## ${h} (${arr.length})\n\n${arr.map((l) => `- ${l}`).join('\n')}\n`;
  return `# Who's who candidates\n\n${sec('ready', lines.ready)}\n${sec('check', lines.check)}\n${sec('unresolved', result.unresolved.map((u) => `${u.canonical} | ${u.reason}`))}\n${sec('generic', result.generic.map((g) => g.canonical))}`;
}

/** One client for Wikidata: search (wbsearchentities) and probe (SPARQL office holders) share the 1 request/second gap. */
export function makeClient({fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), minGapMs = 1100} = {}) {
  let last = 0;
  const get = async (url, accept = 'application/json') => {
    const wait = last + minGapMs - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const res = await fetchImpl(url, {headers: {'User-Agent': UA, 'Accept': accept}});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  const search = async (name) => {
    const body = await get(`${API}?action=wbsearchentities&format=json&language=en&uselang=en&type=item&limit=5&search=${encodeURIComponent(name)}`);
    return (body.search || []).map((h) => ({id: h.id, label: h.label, description: h.description, match: h.match}));
  };
  const probe = async (qid) => {
    const body = await get(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(officeQuery(qid))}`, 'application/sparql-results+json');
    return parseOffice(body);
  };
  return {search, probe};
}
export const makeSearch = (opts) => makeClient(opts).search;

/** Is the item a human / a position, and who held it (P1308 on the office, or P39 on the person) with P580/P582. */
export function officeQuery(qid) {
  if (!WIKIDATA_ID.test(qid)) throw new Error('bad qid');
  return `SELECT ?kind ?h ?hLabel ?hDescription ?s ?e WHERE {
  { BIND("human" AS ?kind) wd:${qid} wdt:P31 wd:Q5. }
  UNION { BIND("position" AS ?kind) wd:${qid} wdt:P31/wdt:P279* ?c. VALUES ?c { wd:Q4164871 wd:Q294414 } }
  UNION { BIND("holder" AS ?kind) wd:${qid} p:P1308 ?st. ?st ps:P1308 ?h. OPTIONAL { ?st pq:P580 ?s. } OPTIONAL { ?st pq:P582 ?e. } }
  UNION { BIND("holder" AS ?kind) ?h p:P39 ?st. ?st ps:P39 wd:${qid}. OPTIONAL { ?st pq:P580 ?s. } OPTIONAL { ?st pq:P582 ?e. } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
}
export function parseOffice(body) {
  const rows = (body && body.results && body.results.bindings) || [];
  const v = (r, k) => (r[k] ? r[k].value : null);
  const out = {isHuman: false, isPosition: false, holders: []};
  for (const r of rows) {
    const kind = v(r, 'kind');
    if (kind === 'human') out.isHuman = true;
    else if (kind === 'position') out.isPosition = true;
    else if (kind === 'holder' && v(r, 'h')) out.holders.push({id: v(r, 'h').split('/').pop(), label: v(r, 'hLabel'), description: v(r, 'hDescription') || '', start: v(r, 's'), end: v(r, 'e')});
  }
  return out;
}

function readLive() {
  // read-only: one GetObject through the aws cli
  return JSON.parse(execFileSync('aws', ['s3', 'cp', `s3://${BUCKET}/record/views/index/active.json`, '-', '--region', 'ap-northeast-1'], {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024}));
}

async function main(argv) {
  const opt = {top: 100, out: null, input: null, aliases: null, cache: null, live: false, write: false};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') opt.live = true; else if (a === '--write') opt.write = true;
    else if (a === '--all') opt.top = Infinity;
    else if (['--top', '--out', '--input', '--aliases', '--cache'].includes(a)) opt[a.slice(2)] = argv[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  opt.top = Number(opt.top);
  if (Number.isNaN(opt.top)) throw new Error('--top needs a number');
  if (!opt.live === !opt.input) throw new Error('give exactly one of --live or --input FILE');
  if (opt.write && !opt.out) throw new Error('--write needs --out DIR');
  if (opt.out && /operator[\\/]aliases\.json$/.test(resolve(opt.out))) throw new Error('refusing: record/operator/aliases.json is operator-owned');
  const data = opt.live ? readLive() : JSON.parse(readFileSync(opt.input, 'utf8'));
  const ranked = countActors(data).slice(0, opt.top);
  const settled = opt.aliases ? settledIds(JSON.parse(readFileSync(opt.aliases, 'utf8'))) : new Set();
  const client = makeClient();
  const cache = opt.cache && existsSync(opt.cache) ? JSON.parse(readFileSync(opt.cache, 'utf8')) : {};
  const cached = (kind, fn) => async (k) => {
    const key = `${kind}:${k}`;
    if (!(key in cache)) { cache[key] = await fn(k); if (opt.cache) writeFileSync(opt.cache, JSON.stringify(cache)); }
    return cache[key];
  };
  const result = await reconcile(ranked, {search: cached('s', client.search), probe: cached('p', client.probe), windows: actorWindows(data), settled, onProgress: (id, r) => console.error(`${r.proposals ? 'ok ' : '-- '} ${id}${r.proposals ? ` -> ${r.proposals.map((p) => `${p.wikidataId} ${p.via}`).join(', ')}` : ` (${r.unresolved})`}`)});
  const summary = {at: new Date().toISOString(), source: opt.live ? `s3://${BUCKET}/record/views/index/active.json` : opt.input, top: opt.top, considered: ranked.length,
    accepted: result.proposals.length, unresolved: result.unresolved.length, generic: result.generic.length, skipped: result.skipped.length};
  if (opt.write) {
    mkdirSync(opt.out, {recursive: true});
    const w = (name, obj) => writeFileSync(join(opt.out, name), `${JSON.stringify(obj, null, 2)}\n`);
    w('aliases.proposals.json', {schemaVersion: 1, note: 'Proposals only. The operator copies accepted lines into record/operator/aliases.json.', proposals: result.proposals});
    w('generic.candidates.json', {schemaVersion: 1, note: 'Names matching the generic list; mark generic:true in the operator file.', candidates: result.generic});
    w('unresolved.json', {schemaVersion: 1, unresolved: result.unresolved});
    w('aliases.candidate.json', buildAliasFile(result));
    writeFileSync(join(opt.out, 'review.md'), reviewMarkdown(result));
    w('summary.json', summary);
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
