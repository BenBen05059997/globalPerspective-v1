// newsSourceAudit prompt fix (2026-11-16): Claude comments on supported claims, and any reply that does not start with "OK" is stored as drift.
// Re-runs the 5 recorded audits (system + user text of the model test, record/audit/inputs/N.txt: the article text and our summary of 5 topics)
// through the shared chat() with the Lambda's options (maxTokens 800, temperature 0) and the Lambda's verdict rule (/^OK\b/i).
//   OUT=<dir> INPUTS=<audit inputs dir> SRC=<index.js holding DRIFT_SYS> node prompt_fixes_audit.mjs <tag> <haiku|sonnet> <reps>
import fs from 'node:fs';
import path from 'node:path';
import * as L from './prompt_fixes_lib.mjs';
const [tag, model = 'haiku', repsArg = '3'] = process.argv.slice(2);
const src = fs.readFileSync(process.env.SRC, 'utf8');
const SYS = new Function(`${/const DRIFT_SYS = .*;/.exec(src)[0]}; return DRIFT_SYS;`)();
const jobs = [];
for (let i = 0; i < 5; i++) for (let r = 1; r <= Number(repsArg); r++) jobs.push({ i, r });
await L.pool(jobs, async ({ i, r }) => {
  const f = path.join(L.OUT, tag, `${i}-${model}-r${r}.json`);
  if (fs.existsSync(f)) return;
  const raw = fs.readFileSync(path.join(process.env.INPUTS, `${i}.txt`), 'utf8');
  const user = raw.slice(raw.indexOf('\nUSER:\n') + 7);
  const res = await L.call(`audit|${tag}`, model, { step: 'source_audit', system: SYS, user, maxTokens: 800, temperature: 0, timeoutMs: 180000, retries: 1 });
  const text = res.content.trim();
  const verdict = /^OK\b/i.test(text) ? 'OK' : 'DRIFT';
  L.write(f, { topic: i, finish: res.finishReason, out: res.usage?.completion_tokens, verdict, lines: text.split('\n').filter(Boolean).length, exactlyOK: text === 'OK', text });
  console.log(tag, i, `r${r}`, res.finishReason, verdict, `out=${res.usage?.completion_tokens}`);
});
console.log('spent', L.spent().toFixed(3), '429 waits', L.stats.retries429);
