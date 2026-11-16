// newsPredictionResolver prompt fix (2026-11-16): the settle-draft prompt did not say that "no" is allowed only on or after deadline + 3 days
// (lib.validateDraft turns an early "no" into not_yet). Re-runs the 5 recorded settle prompts (record/resolver/inputs/*.prompt.txt of the model test:
// question, entries, today) through the shared chat() with index.js's options (settle_draft, temperature 0.1, maxTokens 500, json:true).
// "before" = the recorded prompt. "after" = the same prompt with its `- "no":` rule line replaced by the line the worktree's draft.js builds
// for that question (buildPrompt called on a stub question with the same deadline and today; only that line is taken).
//   OUT=<dir> INPUTS=<resolver inputs dir> node prompt_fixes_resolver.mjs <before|after> <haiku|sonnet> <reps>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as L from './prompt_fixes_lib.mjs';
const require = createRequire(import.meta.url);
const [variant, model = 'sonnet', repsArg = '2'] = process.argv.slice(2);
const draft = require(path.join(L.ROOT, 'backend/predictions/newsPredictionResolver/src/draft.js'));
const lib = require(path.join(L.ROOT, 'backend/predictions/newsPredictionResolver/src/lib.js'));
const files = fs.readdirSync(process.env.INPUTS).filter((f) => f.endsWith('.prompt.txt')).sort();
const jobs = [];
for (const f of files) for (let r = 1; r <= Number(repsArg); r++) jobs.push({ f, r });
await L.pool(jobs, async ({ f, r }) => {
  const id = f.slice(0, 6);
  const out = path.join(L.OUT, `resolver-${variant}`, `${id}-${model}-r${r}.json`);
  if (fs.existsSync(out)) return;
  let prompt = fs.readFileSync(path.join(process.env.INPUTS, f), 'utf8');
  const today = /^Today: (\S+)/m.exec(prompt)[1]; const deadline = /Deadline: (\S+?)\./.exec(prompt)[1];
  if (variant === 'after') {
    const stub = draft.buildPrompt({ question: 'q', storyTitle: 's', issuedAt: '2026-01-01', deadline, resolutionSource: 'x' }, [], today);
    const newLine = stub.split('\n').find((l) => l.startsWith('- "no":'));
    const oldLine = prompt.split('\n').find((l) => l.startsWith('- "no":'));
    if (!newLine || !oldLine || prompt.split(oldLine).length !== 2) throw new Error('"no" line not found exactly once');
    prompt = prompt.replace(oldLine, () => newLine);
  }
  const res = await L.call(`resolver|${variant}`, model, { step: 'settle_draft', user: prompt, temperature: 0.1, maxTokens: 500, json: true, timeoutMs: 180000, retries: 1 });
  let v = null; try { v = JSON.parse(res.content); } catch { /* keep null */ }
  const canNo = today >= addDays(deadline, lib.GRACE_DAYS);
  const rec = { id, today, deadline, canNo, finish: res.finishReason, out: res.usage?.completion_tokens, verdict: v?.verdict ?? 'UNPARSED', prematureNo: v?.verdict === 'no' && !canNo, why: v?.why, quote: v?.quote ? String(v.quote).slice(0, 80) : undefined };
  L.write(out, rec);
  console.log(variant, id, model, `r${r}`, rec.verdict, rec.prematureNo ? 'PREMATURE-NO' : '', rec.finish);
});
function addDays(day, n) { return new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10); }
console.log('spent', L.spent().toFixed(3), '429 waits', L.stats.retries429);
