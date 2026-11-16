'use strict';
// Follow-up to claude-compare.js: the one drift prompt that Sonnet cut off at 500 tokens (USA), asked again with a larger cap and with
// json:true, to see how long the answer really is and whether json:true removes the prose before the JSON. Reads the saved prompt; no AWS.
const fs = require('node:fs');
const path = require('node:path');
const L = require('../../../shared/scripts/claude-compare-lib');
const lib = require('../src/lib');

const dir = path.join(L.OUT, 'drift');
(async () => {
  const rec = JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8')).find((r) => r.iso === 'USA');
  const inp = JSON.parse(fs.readFileSync(path.join(dir, 'inputs', 'USA.json'), 'utf8'));
  const prompt = fs.readFileSync(path.join(dir, 'inputs', 'USA.prompt.txt'), 'utf8');
  const out = [];
  for (const [which, extra, tag] of [['sonnet', {maxTokens: 1500}, 'cap1500'], ['sonnet', {maxTokens: 500, json: true}, 'json500'], ['haiku', {maxTokens: 500, json: true}, 'json500']]) {
    const r = await L.call(which, {step: 'drift_note', user: prompt, temperature: 0.2, ...extra}, dir, `USA:caps:${which}:${tag}`);
    out.push({which, tag, finishReason: r.finishReason, outTokens: r.usage.completion_tokens, startsWithBrace: r.content.trim().startsWith('{'), parsed: Boolean(lib.parseDriftResponse(r.content, inp.events)), raw: r.content});
  }
  fs.writeFileSync(path.join(dir, 'caps-followup.json'), JSON.stringify({firstAnswerSonnetCut: rec.results.sonnet.trace.attempt1.raw.length, out}, null, 1));
  console.log(JSON.stringify(out.map(({raw, ...x}) => x)));
})().catch((e) => { console.error(e.message); process.exit(1); });
