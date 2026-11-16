// Claude comparison for the briefs-and-analysis jobs (2026-11-16): run each rebuilt input on Haiku 5.5 and Sonnet 5.5 through the
// shared chat() with the options the Lambda uses, record the raw answer, finishReason, tokens, latency and the Lambda's own checks.
// Usage: VIEW_CACHE=<dir> OUT=<dir> node claude_briefs_run.mjs <daily|weekly|country|thread|systems|all>
// The key is read from the home-dir key file and set in this process only; it is never printed or written.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
process.env.ANTHROPIC_API_KEY = fs.readFileSync(os.homedir() + '/.gp-anthropic-key.txt', 'utf8').trim();
const require = createRequire(import.meta.url);
const { chat, buildRequest, jsonText, stripCodeFence } = require('../../backend/shared/src/llm.js');
const I = await import('./claude_briefs_inputs.mjs');

const OUT = process.env.OUT; if (!OUT) throw new Error('set OUT');
export const MODELS = { haiku: 'anthropic:claude-haiku-5-5', sonnet: 'anthropic:claude-sonnet-5-5' };
export const PRICE = { haiku: [0.10, 0.50], sonnet: [2, 10] }; // USD per million tokens in / out
const CAP_USD = Number(process.env.CAP_USD || 5.5);
const ledgerFile = path.join(OUT, '_spend.json');
const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : { usd: 0, calls: 0, retries429: 0, perJob: {} };
const save = () => fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1));
export const costOf = (m, u) => ((u?.prompt_tokens || 0) * PRICE[m][0] + (u?.completion_tokens || 0) * PRICE[m][1]) / 1e6;

// one model call, with a patient wait on HTTP 429 (counted) on top of chat()'s own transport retry
export async function call(job, m, opts) {
  if (ledger.usd > CAP_USD) throw new Error(`spend cap reached (${ledger.usd.toFixed(2)} USD)`);
  for (let a = 0; ; a++) {
    try {
      const o = { step: job + '_claude_test', ...opts, model: MODELS[m] };
      if (buildRequest(o).provider !== 'anthropic') throw new Error('guard: not an Anthropic request'); // never DeepSeek
      const r = await chat(o);
      const cost = costOf(m, r.usage);
      ledger.usd += cost; ledger.calls++; ledger.perJob[job] = (ledger.perJob[job] || 0) + cost; save();
      return { r, cost };
    } catch (e) {
      if (/LLM 429/.test(e.message) && a < 6) { ledger.retries429++; save(); await new Promise((x) => setTimeout(x, 20000 * (a + 1))); continue; }
      throw e;
    }
  }
}

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const bold = (s) => (String(s || '').match(/\*\*[^*]+\*\*/g) || []).length;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** What the Lambda's own parse does with the answer, plus the prompt's rules as counts. */
function check(job, sample, content) {
  const raw = String(content || '');
  const fenced = /^\s*```/.test(raw);
  const prose = !fenced && !/^\s*[{[]/.test(raw);
  const trailing = !fenced && /^\s*[{[]/.test(raw) && !/[}\]]\s*$/.test(raw);
  const out = { fenced, proseAround: prose || trailing, issues: [] };
  let p;
  try {
    p = job === 'daily' || job === 'country' ? JSON.parse(jsonText(raw)) : JSON.parse(stripCodeFence(raw, { trailingCommas: job !== 'systems' }));
    out.parseOk = true;
  } catch (e) { out.parseOk = false; out.issues.push('parse: ' + e.message.slice(0, 80)); return out; }
  out.parsed = p;
  const iss = (c, t) => { if (c) out.issues.push(t); };
  if (job === 'daily') {
    iss(!p.headline || !p.summary, 'missing headline/summary (Lambda would throw)');
    const f = I.checkSummaryFormat(p.summary); out.words = f.words; out.bold = f.bold;
    iss(f.words > 350, `summary ${f.words} words (>350)`); iss(f.bold !== 4, `bold phrases ${f.bold} (need exactly 4)`);
    const hw = words(p.headline); iss(hw < 8 || hw > 15, `headline ${hw} words`);
    iss(!(p.topStories?.length >= 5 && p.topStories.length <= 8), `topStories ${p.topStories?.length}`);
    iss(JSON.stringify(Object.keys(p).sort()) !== JSON.stringify(['categoryBreakdown', 'countryToWatch', 'headline', 'risingThread', 'summary', 'topStories']), 'keys differ from the six asked: ' + Object.keys(p).join(','));
    iss(/\n\s*[-*•] /.test(p.summary || '') || /\n#/.test(p.summary || ''), 'summary has bullets or headers');
  } else if (job === 'weekly') {
    const want = sample.threadIds; const got = (p.signals || []).map((s) => s.threadId);
    out.signals = got.length; out.watch = (p.watch || []).length;
    iss(want.some((id) => !got.includes(id)), `signals missing for ${want.filter((id) => !got.includes(id)).length} thread(s)`);
    iss(got.some((id) => !want.includes(id)), 'a signal has an unknown threadId');
    for (const s of p.signals || []) {
      iss(!s.lede || !s.fact, 'a signal lacks lede or fact (the Lambda drops it)');
      iss(words(s.lede) > 10, `lede ${words(s.lede)} words (>10)`);
      iss(!['threat', 'development'].includes(s.kind), 'kind=' + s.kind);
      iss(/\b(will|is going to)\b/i.test(s.soWhat || ''), 'soWhat has bare will/going to');
    }
    iss(out.watch < 3 || out.watch > 5, `watch ${out.watch} (asked 3-5)`);
    iss(Object.keys(p).some((k) => !['signals', 'watch'].includes(k)), 'extra top-level keys: ' + Object.keys(p).join(','));
  } else if (job === 'country') {
    iss(!p.bluf || !p.keyDevelopments, 'missing bluf/keyDevelopments (Lambda would throw)');
    const hw = words(p.headline); iss(hw < 8 || hw > 12, `headline ${hw} words (8-12)`);
    iss(/[.!?]\s+\S/.test(String(p.bluf || '').trim().replace(/\b(U\.S|U\.K|St|Mr|Dr)\./g, '')), 'bluf has more than one sentence');
    const kd = p.keyDevelopments?.length; iss(kd < 5 || kd > 7, `keyDevelopments ${kd} (5-7)`);
    const bt = p.backgroundTimeline?.length; iss(bt < 10 || bt > 15, `backgroundTimeline ${bt} (10-15)`);
    out.bt = bt; out.kd = kd;
    iss((p.riskSignals || []).length < 3 || p.riskSignals.length > 4, `riskSignals ${p.riskSignals?.length} (3-4)`);
    const wm = bold(p.whyItMatters); iss(wm < 3 || wm > 5, `whyItMatters bold ${wm} (3-5)`);
    iss(!['escalating', 'stable', 'de-escalating'].includes(p.trajectory), 'trajectory=' + p.trajectory);
    const dims = p.dimensions || {}; iss(!['conflict', 'political', 'economic', 'humanitarian'].every((k) => k in dims), 'dimensions axes missing');
    iss((p.keyActors || []).length > 8, 'keyActors >8');
    const run = sample.inputNotes.runDate;
    for (const k of p.keyDevelopments || []) iss(!ISO.test(k.date) || k.date > run, `keyDevelopment date ${k.date} after run date ${run}`);
    for (const k of p.backgroundTimeline || []) iss(!ISO.test(k.date) || k.date > run, `timeline date ${k.date} after run date ${run}`);
    for (const r of p.riskSignals || []) for (const d of String(r).match(/\d{4}-\d{2}-\d{2}/g) || []) iss(d <= run, `riskSignal names past date ${d}`);
  } else if (job === 'thread') {
    iss(!p.threadTitle || !p.storyArc, 'missing threadTitle/storyArc (Lambda would throw)');
    const tw = words(p.threadTitle); iss(tw < 6 || tw > 10, `threadTitle ${tw} words (6-10)`); iss(/:/.test(p.threadTitle || ''), 'threadTitle has a colon');
    const ids = sample.entries.map((e) => e.topicId);
    iss((p.entryShortTitles || []).length !== ids.length, `entryShortTitles ${p.entryShortTitles?.length} for ${ids.length} entries`);
    iss((p.entryShortTitles || []).some((x) => !ids.includes(x.topicId)), 'entryShortTitles has a topicId not given');
    iss((p.watchQuestions || []).length !== 3 || p.watchQuestions.some((q) => !/\?$/.test(String(q).trim())), `watchQuestions ${p.watchQuestions?.length}, each must end with ?`);
    iss(p.inflectionTopicId != null && !ids.includes(p.inflectionTopicId), 'inflectionTopicId not one given');
    iss(typeof p.sentiment !== 'number' || p.sentiment < -1 || p.sentiment > 1, 'sentiment=' + p.sentiment);
    iss((p.keyActors || []).length > 5, 'keyActors >5');
    const dims = p.dimensions || {}; iss(!['conflict', 'political', 'economic', 'humanitarian'].every((k) => k in dims), 'dimensions axes missing');
  } else if (job === 'systems') {
    const v = sample.validate(p);
    out.rawNodes = (p.nodes || []).length; out.rawEdges = (p.edges || []).length; out.validNodes = v.nodes.length; out.validEdges = v.edges.length;
    out.edgesDropped = out.rawEdges - out.validEdges; out.nodesDropped = out.rawNodes - out.validNodes;
    const peak = Object.fromEntries(sample.country.threads.map((t) => [t.threadId, t.peakDate]));
    out.effectBeforeCause = v.edges.filter((e) => peak[e.from] && peak[e.to] && peak[e.to] < peak[e.from]).length;
    out.negativeLag = v.edges.filter((e) => e.lagDays < 0).length;
    out.confidenceDowngraded = (p.edges || []).filter((e) => v.edges.some((x) => x.from === e.from && x.to === e.to) && e.confidence && v.edges.find((x) => x.from === e.from && x.to === e.to).confidence !== e.confidence).length;
    iss(out.nodesDropped > 0, `${out.nodesDropped} node(s) dropped by the Lambda`); iss(out.edgesDropped > 0, `${out.edgesDropped} edge(s) dropped by the Lambda`);
    iss(out.effectBeforeCause > 0, `${out.effectBeforeCause} edge(s) effect before cause by peakDate`);
    iss(v.nodes.some((n) => (n.actors || []).length < 3), 'a node has fewer than 3 actors');
    iss(!p.edges?.length, 'no edges');
    iss(Object.keys(p).some((k) => !['nodes', 'edges'].includes(k)), 'extra keys');
  }
  return out;
}

export async function runSample(job, sample, models = ['haiku', 'sonnet']) {
  const dir = path.join(OUT, job, sample.id.replace(/[^A-Za-z0-9_-]+/g, '_'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'input_prompt.txt'), sample.prompt);
  fs.writeFileSync(path.join(dir, 'input_notes.json'), JSON.stringify(sample.inputNotes, null, 1));
  if (sample.baseline) fs.writeFileSync(path.join(dir, 'baseline_deepseek.json'), JSON.stringify(sample.baseline, null, 1));
  for (const m of models) {
    // run 1 = the production cap; if it was cut off (finishReason length) run 2 repeats the call with the cap doubled so the quality
    // comparison has a complete answer. Both are kept: `<m>.json` (production cap) and `<m>.raised.json`.
    for (const variant of ['prod', 'raised']) {
      const tag = variant === 'prod' ? m : `${m}.raised`;
      const f = path.join(dir, `${tag}.json`);
      if (fs.existsSync(f)) continue;
      if (variant === 'raised' && JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8')).finishReason !== 'length') break;
      const opts = variant === 'prod' ? sample.call : { ...sample.call, maxTokens: sample.call.maxTokens * 2 };
      const { r, cost } = await call(job, m, opts);
      const { parsed, ...checks } = check(job.replace(/_extra$/, ''), sample, r.content);
      fs.writeFileSync(path.join(dir, `${tag}.raw.txt`), r.content);
      fs.writeFileSync(f, JSON.stringify({
        model: MODELS[m], variant, maxTokens: opts.maxTokens, finishReason: r.finishReason, latencyMs: r.latencyMs, usage: r.usage, costUsd: cost,
        outputChars: r.content.length, stopReasonRaw: r.raw.stop_reason, checks, parsed: parsed || null,
      }, null, 1));
      console.log(job, sample.id, tag, r.finishReason, `${r.latencyMs}ms`, `in ${r.usage?.prompt_tokens} out ${r.usage?.completion_tokens}`, `$${cost.toFixed(4)}`, checks.parseOk ? '' : 'PARSE-FAIL', checks.issues.length ? `issues=${checks.issues.length}` : '');
    }
  }
}

export async function samples(job) {
  if (job === 'daily') return ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'].map((d) => I.buildDaily(d));
  if (job === 'weekly') return [I.buildWeekly('2026-11-08', { strict: false, storedThreads: true }), I.buildWeekly('2026-11-15')];
  // sequential: the prompt capture is one shared slot
  if (job === 'country') { const o = []; for (const c of ['UKR', 'CHN', 'UGA', 'BRA', 'ETH']) o.push(await I.buildCountry(c)); return o; }
  if (job === 'thread') { const o = []; for (const t of ['thread-former-iraqi-lawmaker-ahmed-al-3e523a', 'thread-microsoft-outlook-teams-and-co-d7517d', 'thread-us-and-china-trade-chiefs-hold-66dcec', 'thread-iranian-navy-reports-tanker-on-efc81f', 'thread-nvidia-board-opens-investigati-e3ca10']) o.push(await I.buildThread(t)); return o; }
  // parse-reliability extension (no judge, no hand check): 15 more threads that the live job analysed on 2026-11-11..14
  if (job === 'thread_extra') {
    const used = new Set(['thread-former-iraqi-lawmaker-ahmed-al-3e523a', 'thread-microsoft-outlook-teams-and-co-d7517d', 'thread-us-and-china-trade-chiefs-hold-66dcec', 'thread-iranian-navy-reports-tanker-on-efc81f', 'thread-nvidia-board-opens-investigati-e3ca10']);
    const ids = I.threadCandidates().filter((c) => c.generatedAt >= '2026-11-11' && c.storedEntries === c.rebuilt && !used.has(c.threadId)).sort((a, b) => a.threadId.localeCompare(b.threadId)).slice(0, 15).map((c) => c.threadId);
    const o = []; for (const t of ids) o.push(await I.buildThread(t)); return o;
  }
  if (job === 'systems') return ['China', 'France', 'Iran'].map((c) => I.buildSystems(c));
  throw new Error('unknown job ' + job);
}

if (process.argv[1] && process.argv[1].endsWith('claude_briefs_run.mjs')) {
  const jobs = process.argv[2] === 'all' ? ['daily', 'weekly', 'country', 'thread', 'systems'] : [process.argv[2]];
  for (const job of jobs) {
    const list = await samples(job);
    let i = 0; // at most 2 calls in flight: two workers over the samples, each sample's two models run one after the other
    await Promise.all([0, 1].map(async () => { while (i < list.length) { const s = list[i++]; try { await runSample(job, s); } catch (e) { console.log('FAILED', job, s.id, e.message.slice(0, 200)); } } }));
  }
  console.log('spend so far USD', ledger.usd.toFixed(3), 'calls', ledger.calls, '429 waits', ledger.retries429);
}
