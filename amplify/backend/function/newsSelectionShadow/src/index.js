'use strict';

// newsSelectionShadow — shadow week for the layered story selector (plan P7, B2). Runs 5 min after each topic selection
// (newsInvokeGemini-dev, 04:15 / 12:15 / 20:15 UTC) and logs what the layered selector WOULD have picked next to what
// was published. Writes only audit/selection-shadow/; nothing on the site reads it.
//   1. candidates: story-scan corpus for the 8 hours before this run (same window as predictions/jev-backtest)
//   2. GDACS Red/Orange events tag disaster stories outlets already report (situations/state/gdacs_*)
//   3. Jev: impact + new-since-last-brief per story, done-or-said per headline (selection-core.js)
//   4. select with the live run's slot count; skip what this job picked in the previous 24h
// Rules live in selection-core.js (shared with the backtest). Needs env JEV_API_KEY.

const core = require('./selection-core');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const JEV_KEY = process.env.JEV_API_KEY;
const WINDOW_H = 8, DAY_MS = 864e5, FRESH_MS = 30 * 6e4;
const MAX_JEV_CALLS = Number(process.env.MAX_JEV_CALLS) || 300; // ~40 stories x 2 calls a run; a guard, not a target
const USD_PER_M = 0.042; // Jev input price per 1M tokens (output is free)

let _s3;
function s3() { if (!_s3) { const { S3Client } = require('@aws-sdk/client-s3'); _s3 = new S3Client({ region: REGION }); } return _s3; }
async function getText(key) {
  try {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const r = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return await r.Body.transformToString();
  } catch (e) {
    if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}
const getJson = async (key) => { const t = await getText(key); return t == null ? null : JSON.parse(t); };
async function putJson(key, obj) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: JSON.stringify(obj), ContentType: 'application/json' }));
}
async function listKeys(prefix) {
  const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
  const out = []; let token;
  do {
    const r = await s3().send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }));
    for (const o of r.Contents || []) if (o.Key.endsWith('.json')) out.push(o.Key);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
}

// One hourly story-scan snapshot (corpus/YYYY/MM/DD/HH.jsonl), [] when that hour is missing.
async function corpusHour(t) {
  const iso = new Date(t).toISOString();
  const text = await getText(`corpus/${iso.slice(0, 10).replace(/-/g, '/')}/${iso.slice(11, 13)}.jsonl`);
  return text ? text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
}
// Dated JSON files (<prefix>/YYYY-MM-DD/HHMM.json) from the 24h before `now`, oldest first.
async function lastDay(prefix, now) {
  const days = [new Date(now - DAY_MS), new Date(now)].map((d) => d.toISOString().slice(0, 10));
  const keys = (await Promise.all(days.map((d) => listKeys(`${prefix}/${d}/`)))).flat();
  const at = (k) => { const m = k.match(/(\d{4}-\d{2}-\d{2})\/(\d{2})(\d{2})\.json$/); return m ? Date.parse(`${m[1]}T${m[2]}:${m[3]}:00Z`) : NaN; };
  return keys.filter((k) => now - at(k) > 0 && now - at(k) < DAY_MS).sort();
}

exports.handler = async () => {
  if (!JEV_KEY) throw new Error('JEV_API_KEY not set');
  const now = Date.now();

  // The live run this shadow run is compared with; no fresh run (selection failed) = nothing to compare, so skip.
  const capture = await getJson('audit/ingest-capture/latest.json');
  if (!capture || now - Date.parse(capture.runId) > FRESH_MS) {
    console.warn('[shadow] no topic-selection run in the last 30 min; skipped', capture && capture.runId);
    return { ok: false, skipped: 'no fresh selection run' };
  }
  const n = capture.chosenCount;

  const hourStart = Math.floor(now / 36e5) * 36e5;
  const hours = await Promise.all(Array.from({ length: WINDOW_H }, (_, i) => corpusHour(hourStart - (i + 1) * 36e5)));
  const byUrl = new Map();
  for (const h of hours.slice().reverse()) for (const a of h) byUrl.set(a.url, a); // newest snapshot wins
  const { cands, skip, events } = core.candidates([...byUrl.values()], new Set(hours[WINDOW_H - 1].map((a) => a.url)));

  const sitKeys = (await listKeys('situations/state/')).filter((k) => k.startsWith('situations/state/gdacs_'));
  core.attachAlerts(cands, (await Promise.all(sitKeys.map(getJson))).filter(Boolean), now);

  // What we published in the previous 24h (Jev's new-since-last-brief) and what this job picked (24h self-dedup).
  const prevCaptures = (await lastDay('audit/ingest-capture', now)).filter((k) => !k.endsWith(`${capture.runId.slice(11, 13)}${capture.runId.slice(14, 16)}.json`) || now - Date.parse(capture.runId) > FRESH_MS);
  const covered = (await Promise.all(prevCaptures.map(getJson))).filter(Boolean).filter((c) => c.runId !== capture.runId).flatMap((c) => c.chosen.map((t) => t.title));
  const ownPrev = (await Promise.all((await lastDay('audit/selection-shadow', now)).map(getJson))).filter(Boolean).flatMap((r) => r.picks.map((p) => core.fromKey(p.key)));
  const seen = (c) => ownPrev.some((k) => core.same(c, k, skip));

  // Jev: one impact/new call per story, one done-or-said call per distinct headline.
  const toScore = core.toScore(cands);
  const jobs = new Map();
  for (const c of toScore) { const s = core.stateOf(c, covered); jobs.set(s, [s, core.QUESTIONS]); const d = core.doneState(c.title); jobs.set(d, [d, core.DONE_Q]); }
  if (jobs.size > MAX_JEV_CALLS) throw new Error(`Jev guard: ${jobs.size} calls > ${MAX_JEV_CALLS}`);
  const answers = new Map(); let inputTokens = 0, model = null;
  await core.pool([...jobs.values()], async ([state, questions]) => { const r = await core.jevAsk(JEV_KEY, state, questions); answers.set(state, r.answer); inputTokens += r.inputTokens; model = r.model; });
  console.log('[usage] ' + JSON.stringify({ fn: process.env.AWS_LAMBDA_FUNCTION_NAME, step: 'jev', model, calls: jobs.size, input_tokens: inputTokens }));

  const scored = toScore.map((c) => { const a = answers.get(core.stateOf(c, covered)); return { c, impact: a.impact, nw: a.nw, done: answers.get(core.doneState(c.title)).done }; });
  const picks = core.select(scored, n, seen);

  // Same story as a published topic: a shared source url, or similar titles (the published title is rewritten, its sources often differ).
  const ourUrls = new Set(capture.chosen.flatMap((t) => t.sourceUrls || []).map(core.urlKey)), ourToks = capture.chosen.map((t) => core.tokens(t.title));
  const alsoPublished = (c) => [...c.urls].some((u) => ourUrls.has(u)) || c.toks.some((x) => ourToks.some((y) => core.jaccard(x, y) >= 0.3));
  const out = {
    generatedAt: new Date(now).toISOString(), comparedWith: { runId: capture.runId, generationId: capture.generationId, slots: n },
    window: { hours: WINDOW_H, articles: byUrl.size, events: events.length, stories: cands.length, scored: scored.length, gdacsTagged: cands.filter((c) => c.alert).length },
    jev: { model, calls: jobs.size, inputTokens, usd: +((inputTokens * USD_PER_M) / 1e6).toFixed(5) },
    picks: picks.map((s) => ({
      storyIds: s.c.ids, title: s.c.title, category: s.c.category, iso3: s.c.iso3, primaryCountry: s.c.primary, actors: [...s.c.ents],
      outlets: s.c.outlets, articles: s.c.articles, severity: s.c.severity, growth: s.c.growth, impact: s.impact, done: s.done, newSinceLastBrief: s.nw,
      ...(s.c.alert ? { gdacs: s.c.alert } : {}), reason: core.why(s), sources: s.c.sources,
      alsoPublished: alsoPublished(s.c), key: core.keyOf(s.c),
    })),
    published: capture.chosen.map((t) => ({ title: t.title, category: t.category })),
  };
  const stamp = out.generatedAt;
  await putJson(`audit/selection-shadow/${stamp.slice(0, 10)}/${stamp.slice(11, 13)}${stamp.slice(14, 16)}.json`, out);
  await putJson('audit/selection-shadow/latest.json', out);
  console.log(`[shadow] ${picks.length}/${n} picks (${out.picks.filter((p) => p.alsoPublished).length} also published) from ${cands.length} stories, ${scored.length} scored; Jev ${jobs.size} calls $${out.jev.usd}`);
  for (const p of out.picks) console.log(`[shadow] ${p.alsoPublished ? '=' : '+'} ${p.title} — ${p.reason}`);
  return { ok: true, picks: picks.length, slots: n, jevCalls: jobs.size };
};
