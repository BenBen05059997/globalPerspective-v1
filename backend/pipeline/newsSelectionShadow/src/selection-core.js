'use strict';

// selection-core — the layered story selector (plan P7, project-docs/prediction/_active/TASK_2026-10-17_grounded_forecast_and_cost.md).
// One copy, used by the newsSelectionShadow Lambda and by predictions/jev-backtest/run.mjs. Pure except jevAsk (fetch).
//   candidates(articles, earlierUrls) — story-scan articles → merged stories (clusterStories groups + same-story merge)
//   attachAlerts(cands, sits, t)      — tag disaster stories that match an active GDACS Red/Orange event
//   QUESTIONS / DONE_Q / stateOf / doneState / jevAsk — what Jev is asked (only what the story scan cannot know)
//   select(scored, n, seen)          — gates + quotas → picks;  why(s) — one reason line per pick
// classifier-core.js is a symlink to newsSituationIngest's copy (zip stores the file), so clustering has one source.

const { clusterStories, normalizeEntity } = require('./classifier-core');

const JACCARD = 0.3, FREQUENT = 0.05, MAX_PER_COUNTRY = 2, RESCUE_MAX = 2, RESCUE_IMPACT = 3.5;
const DONE_MIN = 0.6, NEW_MIN = 0.4, GATE = { imp: 1.5, sev2: 2 }, POLICY_LIFT = 0.5;
const MUST_HAVE = ['climate', 'science', 'society', 'energy', 'business']; // topic-selection prompt rule 7
// Classifier category → the topic selector's 12 categories (axis is the fallback for 'other').
const CATEGORY = { war: 'conflict', unrest: 'society', diplomacy: 'politics', election: 'politics', policy: 'politics', economy: 'economy', markets: 'economy', disaster: 'disaster', health: 'health', tech: 'technology' };
const AXIS_CATEGORY = { conflict: 'conflict', political: 'politics', economic: 'economy', humanitarian: 'society' };
// Decisions inside one country (policy, rates, elections, deals): Jev's impact question asks how far consequences
// reach beyond the country, which under-rates them (v7 blind review lost 4 of 9 pairs this way), so they get a lift.
const POLICY = new Set(['policy', 'economy', 'markets', 'diplomacy', 'election']);

const TRACKING = /^(utm_|at_|ocid|cmpid|ref$|src$|taid|fbclid|ito$|xtor|cid$)/i;
function urlKey(u) {
  try {
    const x = new URL(String(u).replace(/&amp;/g, '&')); x.hash = '';
    for (const k of [...x.searchParams.keys()]) if (TRACKING.test(k)) x.searchParams.delete(k);
    return (x.host.replace(/^www\./, '') + x.pathname.replace(/\/$/, '') + x.search).toLowerCase();
  } catch { return String(u).toLowerCase(); }
}
const tokens = (s) => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
const jaccard = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return n / (a.size + b.size - n || 1); };

// ---------- candidates ----------
const storyId = (a) => clusterStories([a], '')[0]?.storyId || null; // the clusterer's own key for one article (null = it drops the article)
const eligible = (a) => a.kind === 'event' && storyId(a); // events only, plus clusterStories' axis / severity>=2 / iso3 / latlon rules

function mkCand(items, ids) { // one story from classified articles
  const bySev = items.slice().sort((a, b) => b.severity - a.severity);
  const top = bySev[0], seen = new Set(), lead = [];
  for (const i of bySev) if (!seen.has(i.domain) && lead.length < 3) { seen.add(i.domain); lead.push(i); }
  return {
    ids, items, title: top.en_title || top.title, primary: top.iso3[0], iso3: [...new Set(items.flatMap((i) => i.iso3))], domains: [...new Set(items.map((i) => i.domain))], outlets: new Set(items.map((i) => i.domain)).size, articles: items.length,
    severity: top.severity, axis: top.axis, rawCategory: top.category, category: CATEGORY[top.category] || AXIS_CATEGORY[top.axis], growth: 0,
    headlines: lead.map((i) => `${i.en_title || i.title} (${i.domain})`), sources: lead.map((i) => ({ title: i.title, url: i.url, source: i.domain, ...(i.snippet ? { snippet: i.snippet } : {}) })),
    urls: new Set(items.map((i) => urlKey(i.url))), toks: items.map((i) => tokens(i.en_title || i.title)), ents: new Set(items.map((i) => normalizeEntity(i.entities[0])).filter(Boolean)),
  };
}
// Same story: same primary country AND (a shared lead entity OR title-token Jaccard >= 0.3). A "frequent" entity (lead entity of > 5% of
// the window's event articles, e.g. Trump) is not a merge key. Used to merge fragments, to skip what was already picked, and for hindsight.
const frequent = (items) => { const n = {}; for (const i of items) { const e = normalizeEntity(i.entities[0]); if (e) n[e] = (n[e] || 0) + 1; } return new Set(Object.keys(n).filter((e) => n[e] > FREQUENT * items.length)); };
const same = (a, b, skip) => a.primary === b.primary && ([...a.ents].some((e) => !skip.has(e) && b.ents.has(e)) || a.toks.some((x) => b.toks.some((y) => jaccard(x, y) >= JACCARD)));
function mergeCands(cands, skip) { // union-find over `same`
  const parent = cands.map((_, i) => i), find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  cands.forEach((a, i) => { for (let j = i + 1; j < cands.length; j++) if (same(a, cands[j], skip)) parent[find(j)] = find(i); });
  const groups = new Map();
  cands.forEach((c, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(c); });
  return [...groups.values()].map((g) => (g.length === 1 ? g[0] : mkCand(g.flatMap((c) => c.items), g.flatMap((c) => c.ids))));
}
// A pick stored as JSON (shadow output) → the fields `same` needs, so later runs can skip it.
const keyOf = (c) => ({ primary: c.primary, ents: [...c.ents], titles: c.items.map((i) => i.en_title || i.title) });
const fromKey = (k) => ({ primary: k.primary, ents: new Set(k.ents), toks: k.titles.map(tokens) });

// articles: deduplicated story-scan articles of the window; earlierUrls: urls already in the corpus at the window's start (growth).
function candidates(articles, earlierUrls = new Set()) {
  const events = articles.filter(eligible), groups = new Map();
  for (const a of events) { const id = storyId(a); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(a); }
  const clusters = [...groups].map(([id, items]) => mkCand(items, [id]));
  const skip = frequent(events), cands = mergeCands(clusters, skip);
  for (const c of cands) c.growth = c.outlets - new Set(c.items.filter((i) => earlierUrls.has(i.url)).map((i) => i.domain)).size;
  return { cands, skip, events, clusters };
}

// GDACS has no deaths or people-affected field, so a bare alert is not a story (v7: "Tropical Cyclone SIMON-26" lost every pair).
// An alert only marks a disaster story that outlets already report; that story skips the done/impact gates and a Red one gets a reserved slot.
function attachAlerts(cands, sits, t) {
  for (const s of sits) {
    const level = s.history.filter((h) => Date.parse(h.at) <= t).pop()?.level;
    if (!['Red', 'Orange'].includes(level) || (s.closed_at && Date.parse(s.closed_at) <= t)) continue;
    const where = new Set([...s.iso3_origin, ...s.iso3_affected]);
    for (const c of cands) if (c.rawCategory === 'disaster' && where.has(c.primary) && (c.alert !== 'Red')) Object.assign(c, { alert: level, alertText: s.evidence.gdacs_description });
  }
}

// ---------- Jev: only what the story scan cannot know ----------
const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
const QUESTIONS = {
  impact: { type: 'score', instructions: 'How far do the consequences of this story reach beyond the country where it happens (lives, markets, security, policy, how people live, work, eat, move or breathe)?', criteria: ['Local only: no consequence beyond the country of origin', 'Neighbouring countries or one sector are affected', 'Several countries or an industry are affected', 'Wide regional or cross-border consequences for people, markets or security', 'Global: worldwide consequences'] },
  new_since_last_brief: { type: 'noul', instructions: 'The state lists headlines already covered in the previous 24 hours. Is this story a materially new development, rather than a repeat of one of them?', criteria: { true: 'Yes: a materially new development, or not covered before', false: 'No: the same development already covered, or a rewording of it' } },
};
// Operator editorial rule: only things DONE count; things SAID do not. Judged on the main clause, so "Zelenskyy blasts US as
// Russian strikes kill 78" is said (v8); attributed claims, announced/future intentions and anniversaries are said too (v9).
const DONE_Q = { done_or_said: { type: 'choice', instructions: 'Has the action in this headline actually happened, or is it only something said, planned or remembered? Judge the main clause. Answer said when the headline leads with a reaction or words (blasts, slams, condemns, warns, urges, vows, threatens, calls for); when it reports a claim credited to a speaker ("..., police say", "...: Netanyahu", "X says ..."); when the action is only announced, planned or in the future ("to intensify", "will", "plans", "considers"); or when it marks an anniversary or commemoration.', criteria: { done: 'the headline leads with an action or decision that has actually happened: a law/policy enacted, sanctions imposed, a deal signed, troops deployed, strikes carried out, diplomatic ties cut, rates changed, an election held, an acquisition closed, a disaster occurred', said: 'the headline reports what someone said, claimed, plans or remembers: criticism, blame, a reaction, a warning, threat or demand, an attributed claim, an announced or future intention, an anniversary' } } };
const stateOf = (c, covered) => [`Story: ${c.title}`, `Coverage: ${c.outlets} distinct outlet(s), ${c.articles} article(s)`, `Countries: ${c.iso3.join(', ') || 'unspecified'}`,
  `Severity: ${c.severity} of 5`, ...(c.alert ? [`GDACS ${c.alert} alert: ${c.alertText}`] : []), 'Headlines:', ...c.headlines.map((h) => `- ${h}`), 'Already covered in the previous 24h:', ...(covered.length ? covered.map((t) => `- ${t}`) : ['- (nothing)'])].join('\n');
const doneState = (title) => `Headline: ${title}`;
// Jev is asked only about stories the outlet rule could let in (>= 2 outlets, or severity 5 for a 1-outlet rescue).
const toScore = (cands) => cands.filter((c) => c.outlets >= 2 || c.severity === 5);

async function jevAsk(key, state, questions, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(JEV_URL, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'jev-latest', state, questions }), signal: AbortSignal.timeout(30000) }).catch(() => ({ status: 599 }));
    if (r.status === 429 || r.status >= 500) { await sleep(1000 * 2 ** attempt); continue; }
    if (!r.ok) throw new Error(`Jev ${r.status}`);
    const j = await r.json(), a = j.answers;
    return { model: j.model, inputTokens: j.usage.input_tokens, answer: questions === DONE_Q ? { done: a.done_or_said.probabilities.done } : { impact: a.impact.score, nw: a.new_since_last_brief.noul } };
  }
  throw new Error('Jev retries exhausted');
}
async function pool(items, fn, concurrency = 4) { let i = 0; await Promise.all(Array.from({ length: concurrency }, async () => { while (i < items.length) await fn(items[i++]); })); }

// ---------- selection ----------
// scored: [{ c, impact (Jev 0-4), nw (new_since_last_brief), done (P(done) of the title) }]; n = slots (the live selector's count); seen(c) = picked in the previous 24h.
// Gates: P(done) >= DONE_MIN, impact (+ POLICY_LIFT for decisions) >= GATE (severity 2 needs more), new >= NEW_MIN, >= 2 outlets
// (a 1-outlet story only on impact >= RESCUE_IMPACT, at most RESCUE_MAX). A GDACS-alerted disaster story skips done/impact; a Red one takes a reserved slot.
// Rank: impact in 0.5 steps, then growth (outlets now minus 8h earlier), then outlets. Quotas: no category above 25% (rounded up), one of each
// MUST_HAVE with impact >= 2 when available, <= 2 per primary country, ONE story per war (conflict stories sharing a country; v7 filled 5 slots
// with Russia-strikes variants). Slots are not force-filled.
const lifted = (s) => s.impact + (POLICY.has(s.c.rawCategory) ? POLICY_LIFT : 0);
function select(scored, n, seen) {
  const cap = Math.ceil(0.25 * n), cat = {}, cty = {}, picks = [];
  const half = (x) => Math.round(x * 2) / 2;
  const good = (s) => s.c.alert || (s.done >= DONE_MIN && lifted(s) >= (s.c.severity === 2 ? GATE.sev2 : GATE.imp));
  const entry = (s) => s.c.outlets >= 2 || lifted(s) >= RESCUE_IMPACT;
  const eligible_ = scored.filter((s) => s.nw >= NEW_MIN && good(s) && entry(s) && !seen(s.c))
    .sort((a, b) => half(lifted(b)) - half(lifted(a)) || b.c.growth - a.c.growth || b.c.outlets - a.c.outlets);
  const sameWar = (s) => s.c.category === 'conflict' && picks.some((p) => p.c.category === 'conflict' && p.c.iso3.some((x) => s.c.iso3.includes(x)));
  const rescued = () => picks.filter((s) => s.c.outlets < 2).length;
  const ok = (s) => picks.length < n && !picks.includes(s) && (cat[s.c.category] || 0) < cap && (cty[s.c.primary] || 0) < MAX_PER_COUNTRY && !sameWar(s) && (s.c.outlets >= 2 || rescued() < RESCUE_MAX);
  const add = (s) => { picks.push(s); cat[s.c.category] = (cat[s.c.category] || 0) + 1; cty[s.c.primary] = (cty[s.c.primary] || 0) + 1; };
  const red = eligible_.find((s) => s.c.alert === 'Red' && ok(s));
  if (red) add(red);
  for (const k of MUST_HAVE) { const s = eligible_.find((x) => x.c.category === k && lifted(x) >= 2 && ok(x)); if (s) add(s); }
  for (const s of eligible_) if (ok(s)) add(s);
  return picks;
}
const why = (s) => [`done ${s.done.toFixed(2)}`, `impact ${s.impact.toFixed(2)}${POLICY.has(s.c.rawCategory) ? ` +${POLICY_LIFT} decision` : ''}`, `${s.c.outlets} outlets (+${s.c.growth} in 8h)`, `severity ${s.c.severity}`, ...(s.c.alert ? [`GDACS ${s.c.alert}`] : [])].join(' · ');

module.exports = { DONE_MIN, NEW_MIN, GATE, MUST_HAVE, urlKey, tokens, jaccard, eligible, mkCand, frequent, same, mergeCands, keyOf, fromKey, candidates, attachAlerts, QUESTIONS, DONE_Q, stateOf, doneState, toScore, jevAsk, pool, lifted, select, why };
