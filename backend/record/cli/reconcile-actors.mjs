#!/usr/bin/env node
// Operator script (0039 alias rule layer 2, 0040 rule 4): propose Wikidata ids for the most-cited actors. No model.
// Never writes record/operator/aliases.json (operator-owned); it writes proposals the operator copies from.
//
//   node reconcile-actors.mjs [--live | --input FILE] [--top 100] [--aliases FILE] [--out DIR] [--write]
//
//   --live         read record/views/index/active.json from the world bucket (read-only `aws s3 cp`, ap-northeast-1)
//   --input FILE   a local active.json (stories[].actorIds), a {id: count} map, or a JSON array of ids
//   --aliases FILE the operator aliases.json (local copy); ids it already maps or pins are skipped
//   --write        write aliases.proposals.json, generic.candidates.json, unresolved.json, summary.json into --out; without it
//                  nothing is written and the summary is printed (dry run)
// Wikidata wbsearchentities: at most 1 request/second, polite User-Agent, one request per name.
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const BUCKET = 'globalperspective-world-280362093938';
const UA = 'GlobalPerspectivesReconcile/1.0 (https://globalperspective.net; benlai310@gmail.com)';
const API = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_ID = /^Q[1-9][0-9]*$/;

// Plural nouns that name a crowd, not an entity. A name is generic when it is exactly one of GENERIC_NAMES, or its last word is a GENERIC_NOUN.
const GENERIC_NAMES = new Set(['the government', 'government', 'government officials', 'officials', 'authorities', 'the authorities', 'the public', 'the opposition', 'opposition', 'police', 'security forces', 'the military', 'the army']);
const GENERIC_NOUNS = new Set(['protesters', 'protestors', 'demonstrators', 'students', 'civilians', 'residents', 'voters', 'settlers', 'migrants', 'refugees', 'officials', 'soldiers', 'rebels', 'militants', 'pirates', 'workers', 'farmers', 'lawmakers', 'critics', 'activists', 'police', 'residents', 'citizens', 'people', 'fans', 'investors', 'traders', 'teachers', 'doctors', 'prisoners', 'hostages', 'victims']);

// Description classes (Wikidata descriptions are short English phrases): a hit is acceptable only when its description names one.
const CLASSES = [
  ['human', /\b(politician|president|prime minister|minister|chancellor|monarch|king|queen|emperor|pope|bishop|leader|head of state|head of government|governor|mayor|senator|diplomat|ambassador|general|admiral|officer|commander|activist|journalist|lawyer|judge|economist|businessperson|businessman|businesswoman|entrepreneur|billionaire|investor|executive|ceo|chief|spokesperson|official|scientist|physician|professor|writer|actor|actress|singer|footballer|athlete|player|coach|astronaut|philanthropist|revolutionary|dissident|militant|cleric|ayatollah|imam|sultan|emir|prince|princess|chairman|chairwoman|speaker|secretary|attorney|prosecutor|politicia)\b/],
  ['organization', /\b(organi[sz]ation|company|corporation|agency|institution|association|union|alliance|bank|party|council|committee|commission|court|army|armed forces|military|navy|air force|police|ministry|department|government|parliament|congress|senate|assembly|movement|group|coalition|network|foundation|university|newspaper|broadcaster|network|cartel|militia|brigade|front|force|forces|treaty organi[sz]ation|intergovernmental|non-governmental|ngo|bureau|service|authority|administration|cabinet|programme|program|news channel|broadcaster|airline|enterprise|firm)\b/],
  ['political party', /\bpolitical party\b/],
  ['armed group', /\b(armed group|rebel group|militant|paramilitary|terrorist|insurgent|militia|guerrilla|rebel)\b/],
  ['government agency', /\b(government agency|federal agency|executive department|ministry|government department|intelligence agency|regulatory)\b/],
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

/**
 * The conservative rule: the top hit only; its label equals the name (exact) or it matched an alias that equals the name (alias);
 * and its description names an allowed class. Returns {proposal} or {unresolved: reason}.
 */
export function accept(id, hits) {
  const name = fold(nameOf(id));
  const top = Array.isArray(hits) ? hits[0] : null;
  if (!top) return {unresolved: 'no hit'};
  if (!WIKIDATA_ID.test(top.id || '')) return {unresolved: 'no entity id'};
  const type = top.match && top.match.type;
  let confidence = null;
  if (fold(top.label || '') === name && (type === 'label' || !type)) confidence = 'exact';
  else if (type === 'alias' && fold(top.match.text || '') === name) confidence = 'alias';
  else if (type === 'label' && fold(top.match.text || '') === name) confidence = 'exact';
  if (!confidence) return {unresolved: `top hit "${top.label}" does not match`};
  const cls = classOf(top.description);
  if (!cls) return {unresolved: `description "${top.description || ''}" is not an allowed class`};
  return {proposal: {canonical: id, wikidataId: top.id, label: top.label, description: top.description || '', confidence}};
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

/** Run the reconcile over ranked [id, count] pairs. `search(name)` returns the hit list; no network happens here. */
export async function reconcile(ranked, {search, settled = new Set(), onProgress = () => {}}) {
  const proposals = [], unresolved = [], generic = [], skipped = [];
  for (const [id, count] of ranked) {
    if (!String(id).startsWith('name:') || settled.has(id)) { skipped.push({id, count}); continue; }
    const name = nameOf(id);
    if (isGenericName(name)) { generic.push({canonical: id, count}); continue; }
    let r;
    try { r = accept(id, await search(name)); } catch (e) { r = {unresolved: `search failed: ${e.message}`}; }
    if (r.proposal) proposals.push({...r.proposal, count}); else unresolved.push({canonical: id, count, reason: r.unresolved});
    onProgress(id, r);
  }
  return {proposals, unresolved, generic, skipped};
}

export function makeSearch({fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), minGapMs = 1100} = {}) {
  let last = 0;
  return async (name) => {
    const wait = last + minGapMs - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const url = `${API}?action=wbsearchentities&format=json&language=en&uselang=en&type=item&limit=3&search=${encodeURIComponent(name)}`;
    const res = await fetchImpl(url, {headers: {'User-Agent': UA, 'Accept': 'application/json'}});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return (body.search || []).map((h) => ({id: h.id, label: h.label, description: h.description, match: h.match}));
  };
}

function readLive() {
  // read-only: one GetObject through the aws cli
  return JSON.parse(execFileSync('aws', ['s3', 'cp', `s3://${BUCKET}/record/views/index/active.json`, '-', '--region', 'ap-northeast-1'], {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024}));
}

async function main(argv) {
  const opt = {top: 100, out: null, input: null, aliases: null, live: false, write: false};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') opt.live = true; else if (a === '--write') opt.write = true;
    else if (['--top', '--out', '--input', '--aliases'].includes(a)) opt[a.slice(2)] = argv[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  opt.top = Number(opt.top);
  if (!opt.live === !opt.input) throw new Error('give exactly one of --live or --input FILE');
  if (opt.write && !opt.out) throw new Error('--write needs --out DIR');
  if (opt.out && /operator[\\/]aliases\.json$/.test(resolve(opt.out))) throw new Error('refusing: record/operator/aliases.json is operator-owned');
  const data = opt.live ? readLive() : JSON.parse(readFileSync(opt.input, 'utf8'));
  const ranked = countActors(data).slice(0, opt.top);
  const settled = opt.aliases ? settledIds(JSON.parse(readFileSync(opt.aliases, 'utf8'))) : new Set();
  const result = await reconcile(ranked, {search: makeSearch(), settled, onProgress: (id, r) => console.error(`${r.proposal ? 'ok ' : '-- '} ${id}${r.proposal ? ` -> ${r.proposal.wikidataId}` : ` (${r.unresolved})`}`)});
  const summary = {at: new Date().toISOString(), source: opt.live ? `s3://${BUCKET}/record/views/index/active.json` : opt.input, top: opt.top, considered: ranked.length,
    accepted: result.proposals.length, unresolved: result.unresolved.length, generic: result.generic.length, skipped: result.skipped.length};
  if (opt.write) {
    mkdirSync(opt.out, {recursive: true});
    const w = (name, obj) => writeFileSync(join(opt.out, name), `${JSON.stringify(obj, null, 2)}\n`);
    w('aliases.proposals.json', {schemaVersion: 1, note: 'Proposals only. The operator copies accepted lines into record/operator/aliases.json.', proposals: result.proposals});
    w('generic.candidates.json', {schemaVersion: 1, note: 'Names matching the generic list; mark generic:true in the operator file.', candidates: result.generic});
    w('unresolved.json', {schemaVersion: 1, unresolved: result.unresolved});
    w('summary.json', summary);
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
