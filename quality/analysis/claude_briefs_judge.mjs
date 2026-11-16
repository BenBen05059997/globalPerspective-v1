// Claude comparison for the briefs-and-analysis jobs (2026-11-16): blind A/B judge (Sonnet 5.5), each pair in both orders, judged against
// the input the models were given. Pairs: bh = stored DeepSeek output vs haiku, sh = haiku vs sonnet, bs = stored DeepSeek vs sonnet.
// The judge sees only "OUTPUT A" / "OUTPUT B". A pair is skipped when either side has no usable output (parse failure).
// Usage: VIEW_CACHE=<dir> OUT=<dir> node claude_briefs_judge.mjs <job|all> [pairs=bh,sh]
import fs from 'node:fs';
import path from 'node:path';
const run = await import('./claude_briefs_run.mjs'); // sets the key and gives call() and samples()
const { call } = run;
const OUT = process.env.OUT;
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));

// The comparable body of an output: only what the model wrote, with the Lambda's own slices applied, same fields on both sides.
export function body(job, v, ctx = {}) {
  if (!v) return null;
  if (job === 'daily') {
    return {
      ...pick(v, ['headline', 'summary']),
      topStories: (v.topStories || []).slice(0, 8).map((s) => pick(s, ['title', 'category', 'regions', 'prediction', 'sourceCount'])),
      risingThread: v.risingThread && pick(v.risingThread, ['title', 'articleCount', 'dayCount', 'trajectory', 'oneLiner']),
      countryToWatch: v.countryToWatch && pick(v.countryToWatch, ['countryName', 'riskLevel', 'headline', 'trajectory']),
      categoryBreakdown: v.categoryBreakdown,
    };
  }
  if (job === 'weekly') {
    return {
      signals: (v.signals || []).filter((s) => !ctx.threadIds || ctx.threadIds.includes(s.threadId)).map((s) => pick(s, ['threadId', 'kind', 'lede', 'fact', 'soWhat', 'related'])),
      watch: (v.watch || []).slice(0, 6),
    };
  }
  if (job === 'country') {
    return {
      ...pick(v, ['headline', 'bluf', 'whyItMatters', 'crossThreadInsight', 'trajectory', 'trajectoryDetail', 'dimensions']),
      keyDevelopments: (v.keyDevelopments || []).slice(0, 7), backgroundTimeline: (v.backgroundTimeline || []).slice(0, 15),
      riskSignals: (v.riskSignals || []).slice(0, 4), keyActors: (v.keyActors || []).slice(0, 8),
    };
  }
  if (job === 'thread') {
    return { ...pick(v, ['threadTitle', 'entryShortTitles', 'storyArc', 'trajectory', 'rootCauseChain', 'watchQuestions', 'inflectionTopicId', 'dimensions', 'sentiment']), keyActors: (v.keyActors || []).slice(0, 5) };
  }
  return v;
}
const titlesOf = (sample) => Object.fromEntries(sample.country.threads.map((x) => [x.threadId, x.title]));
const edgeView = (t, e, cited) => ({ cause: t[e.from] || e.from, effect: t[e.to] || e.to, lagDays: e.lagDays, confidence: e.confidence, mechanism: e.mechanism, cited: cited.map((c) => `${c.date} ${c.title}`) });
const systemsEdges = (sample, parsed) => ({ edges: sample.validate(parsed).edges.map((e) => edgeView(titlesOf(sample), e, e.cited || [])) });
// only edges between threads the model was given (the stored web may hold a thread the rebuilt input lacks)
const baseSystemsEdges = (sample) => ({ edges: sample.baseline.links.filter((e) => titlesOf(sample)[e.from] && titlesOf(sample)[e.to]).map((e) => edgeView(titlesOf(sample), e, e.cited || [])) });

const SYSTEM = 'You are a strict, careful evaluator of AI-written news analysis. You judge only against the INPUT that the writers were given. Reply with one JSON object only.';
function judgePrompt(input, a, b) {
  return `Two analysts (A and B) were given the same task and INPUT below. Judge which output is better. Criteria, in this order: (1) accuracy to the INPUT: anything stated that the INPUT does not support is an invented fact (dates, names, numbers, meetings, events, causes); (2) following the rules the task prompt sets; (3) usefulness to a reader. Do not reward length. Do not guess which model wrote which.

=== TASK AND INPUT GIVEN TO BOTH ANALYSTS ===
${input}
=== END OF TASK AND INPUT ===

=== OUTPUT A ===
${JSON.stringify(a, null, 1)}
=== END OUTPUT A ===

=== OUTPUT B ===
${JSON.stringify(b, null, 1)}
=== END OUTPUT B ===

Return JSON: {"winner":"A"|"B"|"tie","reason":"<2-3 sentences>","unsupportedA":["<each claim in A not supported by the INPUT>"],"unsupportedB":[],"brokenRulesA":["<each rule of the task that A broke>"],"brokenRulesB":[]}`;
}

/** The complete answer to judge: the raised-cap run when the production run was cut off. */
export function effective(dir, m) {
  const prod = JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8'));
  const rf = path.join(dir, `${m}.raised.json`);
  return prod.finishReason === 'length' && fs.existsSync(rf) ? JSON.parse(fs.readFileSync(rf, 'utf8')) : prod;
}

async function judgePair(job, sample, dir, X, Y) {
  const ctx = { threadIds: sample.threadIds };
  const get = (who) => {
    if (who === 'base') {
      if (job === 'systems') return baseSystemsEdges(sample);
      return sample.baseline ? body(job, sample.baseline, ctx) : null;
    }
    const e = effective(dir, who);
    if (!e.checks.parseOk || !e.parsed) return null;
    return job === 'systems' ? systemsEdges(sample, e.parsed) : body(job, e.parsed, ctx);
  };
  const x = get(X); const y = get(Y);
  if (!x || !y) return { skipped: `${!x ? X : Y} output unusable or absent` };
  for (const [label, a, b, aw, bw] of [['XY', x, y, X, Y], ['YX', y, x, Y, X]]) {
    const f = path.join(dir, `judge_${X}_vs_${Y}_${label}.json`);
    if (fs.existsSync(f)) continue;
    const { r, cost } = await call('judge_' + job, 'sonnet', { system: SYSTEM, user: judgePrompt(sample.prompt, a, b), maxTokens: 3000, json: true });
    let j; try { j = JSON.parse(r.content); } catch { j = { parseError: r.content.slice(0, 200) }; }
    const winnerModel = j.winner === 'A' ? aw : j.winner === 'B' ? bw : j.winner === 'tie' ? 'tie' : null;
    fs.writeFileSync(f, JSON.stringify({
      order: `A=${aw} B=${bw}`, winnerModel, finishReason: r.finishReason, costUsd: cost, judge: j,
      unsupported: { [aw]: j.unsupportedA || [], [bw]: j.unsupportedB || [] }, broken: { [aw]: j.brokenRulesA || [], [bw]: j.brokenRulesB || [] },
    }, null, 1));
    console.log('judge', job, sample.id, `${aw}|${bw}`, '->', winnerModel, `$${cost.toFixed(3)}`);
  }
  return {};
}

if (process.argv[1] && process.argv[1].endsWith('claude_briefs_judge.mjs')) {
  const jobs = process.argv[2] === 'all' ? ['daily', 'weekly', 'country', 'thread', 'systems'] : [process.argv[2]];
  const pairs = (process.argv[3] || 'bh,sh').split(',');
  const PAIRS = { bh: ['base', 'haiku'], sh: ['haiku', 'sonnet'], bs: ['base', 'sonnet'] };
  for (const job of jobs) {
    const list = await run.samples(job);
    const work = [];
    for (const s of list) for (const p of pairs) work.push([s, PAIRS[p]]);
    let i = 0;
    await Promise.all([0, 1].map(async () => {
      while (i < work.length) {
        const [s, [X, Y]] = work[i++];
        const dir = path.join(OUT, job, s.id.replace(/[^A-Za-z0-9_-]+/g, '_'));
        try { const r = await judgePair(job, s, dir, X, Y); if (r.skipped) console.log('skip', job, s.id, X, Y, r.skipped); } catch (e) { console.log('JUDGE FAILED', job, s.id, X, Y, e.message.slice(0, 160)); }
      }
    }));
  }
  console.log('judge done');
}
