// newsDriftCorrector prompt fix (2026-11-16): "Return ONLY JSON" is ignored (prose or a code fence first). Re-runs the 5 recorded drift inputs (country,
// prior/current snapshots, event list; record/drift/inputs/<ISO>.json of the model test) through the Lambda's own buildDriftPrompt, parseDriftResponse
// and direction check, and the shared chat() with callLLM's options (plain text, maxTokens 1000, temperature 0.2).
//   OUT=<dir> INPUTS=<inputs dir> SRC=<drift src dir> node prompt_fixes_drift.mjs <tag> <haiku|sonnet> <reps>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as L from './prompt_fixes_lib.mjs';
const require = createRequire(import.meta.url);
const [tag, model = 'haiku', repsArg = '2'] = process.argv.slice(2);
const lib = require(path.join(process.env.SRC, 'lib.js'));
const dirCheck = require(path.join(process.env.SRC, 'directionCheck.js'));
const COUNTRIES = ['UKR', 'USA', 'COD', 'DEU', 'CHN'];
const jobs = [];
for (const c of COUNTRIES) for (let r = 1; r <= Number(repsArg); r++) jobs.push({ c, r });
await L.pool(jobs, async ({ c, r }) => {
  const f = path.join(L.OUT, tag, `${c}-${model}-r${r}.json`);
  if (fs.existsSync(f)) return;
  const inp = JSON.parse(fs.readFileSync(path.join(process.env.INPUTS, `${c}.json`), 'utf8'));
  const subject = /Our automated read on (.+?) moved between/.exec(fs.readFileSync(path.join(process.env.INPUTS, `${c}.prompt.txt`), 'utf8'))[1];
  const prompt = lib.buildDriftPrompt(subject, inp.drift.prior, inp.drift.current, inp.events);
  const res = await L.call(`drift|${tag}`, model, { step: 'drift_note', user: prompt, temperature: 0.2, maxTokens: 1000, timeoutMs: 180000, retries: 1 });
  const raw = res.content;
  const note = lib.parseDriftResponse(L.jsonText(raw), inp.events);
  const ctx = { axisMovesArr: lib.axisMoves(inp.drift.prior, inp.drift.current), changeDimensions: lib.changeDimensionsFrom(inp.drift.moved) };
  const verdict = note ? dirCheck.checkDrift(note, ctx) : null;
  const check = { startsWithBrace: /^\s*\{/.test(raw), fenced: /```/.test(raw), proseBefore: !/^\s*(\{|```)/.test(raw), endsWithBrace: /\}\s*$/.test(raw), parsed: Boolean(note), directionOk: verdict ? verdict.ok : null, noSingleDriver: note?.noSingleDriver ?? null, outTokens: res.usage?.completion_tokens };
  L.write(f, { country: c, finish: res.finishReason, check, raw, note });
  console.log(tag, c, `r${r}`, res.finishReason, JSON.stringify(check));
});
console.log('spent', L.spent().toFixed(3), '429 waits', L.stats.retries429);
