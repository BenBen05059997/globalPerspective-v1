// node --test backend/record/cli/recover-late.test.mjs   (no network, no AWS, no model: the chat function is a stub)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { main } from './recover-late-slots.mjs';
import { poolAsOf, windowAsOf, makeMeter, captureUsage, priceOf, costOf, mapLimit, SLOTS, FETCH_WINDOW_MS } from './recover-late-lib.mjs';

const require = createRequire(import.meta.url);
const inbox = require('../../shared/src/entriesInbox.js');
const { resolveProvider } = require('../../shared/src/llm.js');
const { makeS3Json } = require('../../shared/src/s3json.js');
const prices = require('../../monitoring/newsHealth/src/prices.json');

const REAL_NOW = '2026-11-17T02:00:00.000Z';
const [S1, S2, S3, S4] = SLOTS;
const iso = (ms) => new Date(ms).toISOString();
const feedOf = (i) => ['BBC World', 'Al Jazeera', 'France24', 'SCMP'][i % 4];
let n = 0;
/** A raw article line: published `hoursBefore` before `fetched`, first seen at `fetched`. */
const art = (word, fetched, hoursBefore = 2, extra = {}) => {
  n += 1;
  const f = Date.parse(fetched);
  return { schemaVersion: 1, rawId: `raw${n}`, url: `https://x${n}.example/${word}-${n}`, canonicalUrl: `https://x${n}.example/${word}-${n}`, title: `${word} ${n}x ${n}y ${n}z happens`, outlet: 'X', feed: feedOf(n), publishedAt: iso(f - hoursBefore * 3600000), fetchedAt: fetched, snippet: `${word} snippet ${n} reports a thing.`, lang: 'en', ...extra };
};
const wordsOf = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
function fixtures() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'late-'));
  const articles = { '2026-11-14': [], '2026-11-15': [] };
  const put = (word, fetched) => { for (let i = 0; i < 6; i++) articles[fetched.slice(0, 10)].push(art(word, fetched, 1 + i)); };
  put('Alpha', '2026-11-14T20:15:21.000Z'); // first seen by slot 1
  put('Bravo', '2026-11-15T04:15:20.000Z');
  put('Charlie', '2026-11-15T12:15:22.000Z');
  put('Delta', '2026-11-15T20:15:19.000Z');
  // first seen after every slot, published 11-15: in the 11-15 file, never in a pool
  articles['2026-11-15'].push(...Array.from({ length: 6 }, (_, i) => art('Echo', '2026-11-16T04:15:19.000Z', 1 + i, { publishedAt: iso(Date.parse('2026-11-15T23:00:00Z') - i * 60000) })));
  articles['2026-11-14'] = articles['2026-11-14'].filter((l) => l.fetchedAt <= '2026-11-14T21:00:00.000Z');
  for (const [day, lines] of Object.entries(articles)) { fs.mkdirSync(path.join(dir, 'articles'), { recursive: true }); fs.writeFileSync(path.join(dir, 'articles', `${day}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n'); }
  // one live run on 11-14 at 12:25 and one old line, as the live agent wrote them
  const live = inbox.inboxLines([{
    topicId: 'Live topic-0', threadId: 'thread-live', title: 'Live story about Zulu', category: 'politics', regions: [], search_keywords: ['zulu'], iso3: [], actors: [], event_type: 'other',
    sources: [{ source: 'bbc.com', title: 'Zulu', url: 'https://live.example/zulu', publishedAt: '2026-11-14T10:00:00.000Z' }], archivedAt: '2026-11-14T12:25:36.000Z', generationId: 'gen-live', ai: { summary: 's', prediction: null, trace_cause: null },
  }], { batch: '2026-11-14T12:26:36.842Z', selection: { topics: {}, run: { of: 1, model: 'm', limit: 13, updatedAt: '2026-11-14T12:15:50.000Z', generationId: 'gen-live' } } });
  fs.mkdirSync(path.join(dir, 'entries'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'entries', '2026-11-14.jsonl'), live.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return dir;
}

// A stub of llm.js chat: the selection picks the first 3 prompt rows not already covered; summary and cause answer with fixed text. Prints [usage] as llm.js does.
function stubChat(log = []) {
  let inFlight = 0;
  let peak = 0;
  const chat = async (opts) => {
    log.push({ step: opts.step, model: opts.model, maxTokens: opts.maxTokens, json: opts.json });
    inFlight += 1; peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    const usage = { prompt_tokens: 1000, completion_tokens: 200 };
    console.log(`[usage] ${JSON.stringify({ step: opts.step, model: String(opts.model).replace(/^anthropic:/, ''), ...usage })}`);
    let content;
    if (opts.step === 'topic_selection') {
      const rows = [...opts.user.matchAll(/\d+\. (\S+ \d+x \d+y \d+z happens)\n\s+Source: (\S+)\n\s+Published: [^\n]*\n\s+URL: (\S+)/g)];
      const seenBlock = opts.user.includes('PREVIOUSLY COVERED TODAY') ? opts.user.split('PREVIOUSLY COVERED TODAY')[1].split('NARRATIVE')[0] : '';
      const pick = rows.filter((r) => !seenBlock.includes(r[1])).slice(0, 3);
      content = JSON.stringify({ topics: pick.map((r, i) => ({ title: `${r[1]} lands in ${i}`, category: 'politics', search_keywords: ['k'], regions: ['France'], sources: [{ url: r[3], title: r[1], tier: 'primary' }], x_trending: false, significance: 'high', urgency: 'high', urgencyReason: 'r', primaryCountry: 'France', mentionedCountries: [], iso3: ['FRA'], actors: ['Someone Named'], event_type: 'policy' })) });
    } else if (opts.step === 'summary') content = '- The thing happened per BBC.';
    else content = JSON.stringify({ proximate: { what: 'w', when: 'now' }, contributing: [], structural: { factor: 'f', depth: 'd' }, impactScores: { humanImpact: 1, economicReach: 1, geopolitical: 1 }, biasNote: 'b', alternativePerspective: 'a', signalVsNoise: { verdict: 'Uncertain', confidence: 'Low' } });
    return { content, model: String(opts.model).replace(/^anthropic:/, ''), usage, finishReason: 'stop', latencyMs: 5 };
  };
  chat.peak = () => peak;
  return chat;
}
const quietRun = async (argv, injected) => {
  const logs = [];
  const orig = console.log;
  console.log = (...a) => { logs.push(a.join(' ')); };
  try { return { code: await main(argv, injected), logs }; } finally { console.log = orig; }
};
const readLines = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('poolAsOf: first seen by the slot, age as of the slot, live age filter, feed order, unknown feeds counted', () => {
  const slotMs = Date.parse(S1);
  const lines = [
    art('A', '2026-11-14T20:15:21.000Z', 2), art('B', '2026-11-14T12:15:20.000Z', 30), art('C', '2026-11-14T12:15:20.000Z', 80),
    art('D', '2026-11-14T21:15:00.000Z', 1), // first seen an hour after the slot
    art('E', '2026-11-14T12:15:20.000Z', 1, { feed: 'No Such Feed' }), art('F', '2026-11-14T12:15:20.000Z', 1, { publishedAt: null }),
    { ...art('G', '2026-11-14T12:15:20.000Z', 1), url: 'https://archive.org/x' },
  ];
  const dupe = { ...lines[0], fetchedAt: '2026-11-14T20:15:40.000Z' }; // the same rawId in a second file
  const { articles, stats } = poolAsOf([...lines, dupe], slotMs);
  const titles = articles.map((a) => a.title.split(' ')[0]);
  assert.deepEqual(titles.sort(), ['A', 'B', 'F']);
  assert.equal(stats.afterSlot, 1);
  assert.equal(stats.unknownFeed, 1);
  assert.equal(stats.duplicateRawId, 1);
  assert.equal(stats.filtered, 2, 'the 80 h old item and the archive.org url');
  assert.equal(articles.find((a) => a.title.startsWith('A')).age, '1 hour ago');
  assert.equal(articles.find((a) => a.title.startsWith('F')).age, '');
  assert.equal(articles.find((a) => a.title.startsWith('A')).source, feedSource(lines[0].feed));
  assert.ok(FETCH_WINDOW_MS >= 60000);
});
const feedSource = (name) => require('../../pipeline/newsInvokeGemini/src/selection.js').RSS_FEEDS.find((f) => f.name === name).source;

test('windowAsOf: titles, threading window and seen-today list as of the slot, from live lines and the script\'s own earlier slots', () => {
  const line = (title, batch, extra = {}) => ({ topicId: `${title}-0`, threadId: 'th', title, archivedAt: batch, batch, inboxId: `${batch}|0`, n: 0, ...extra });
  const liveByDay = {
    '2026-11-14': [line('Early live', '2026-11-14T04:26:00.000Z', { run: { of: 1, updatedAt: '2026-11-14T04:15:50.000Z' } }), line('After the slot', '2026-11-14T23:00:00.000Z')],
    '2026-11-13': [line('Day before', '2026-11-13T04:26:00.000Z')],
  };
  const replayed = { '2026-11-15': [line('Replayed one', '2026-11-17T01:00:00.000Z', { writtenLate: { writtenAt: '2026-11-17T01:00:00.000Z', slot: S2 } })] };
  const w = windowAsOf({ liveByDay, replayed, slotMs: Date.parse(S3) });
  assert.deepEqual(w.pastArchiveTitles.map((t) => [t.date, t.title]).sort(), [['2026-11-13', 'Day before'], ['2026-11-14', 'After the slot'], ['2026-11-14', 'Early live'], ['2026-11-15', 'Replayed one']].sort());
  assert.deepEqual(w.seenEntries.map((e) => e.title).sort(), ['After the slot', 'Replayed one'], 'the runs at or before the slot and inside 24 h: not the 04:15 run of the day before (32 h), not the run after the slot');
});

test('the meter refuses a non-Anthropic model, a call past the cap, and counts the cost of a usage line', async () => {
  const chat = async () => ({});
  const meter = makeMeter({ chat, resolveProvider, prices, capUsd: 5 });
  await assert.rejects(() => meter.call({ step: 's', model: 'deepseek-v4-pro', user: 'x', maxTokens: 10 }), /refusing a call to deepseek/);
  await assert.rejects(() => meter.call({ step: 's', model: 'deepseek:deepseek-flash', user: 'x', maxTokens: 10 }), /refusing a call to deepseek/);
  const tight = makeMeter({ chat, resolveProvider, prices, capUsd: 0.001 });
  await assert.rejects(() => tight.call({ step: 's', model: 'anthropic:claude-sonnet-5-5', user: 'x'.repeat(10000), maxTokens: 12000 }), /spend cap/);
  const price = priceOf(prices, 'anthropic:claude-sonnet-5-5');
  assert.deepEqual(price, { in: 2, out: 10, cacheHit: 0.2 });
  assert.equal(costOf(price, { prompt_tokens: 1000000, completion_tokens: 100000 }), 3);
  const restore = captureUsage(meter, { log: () => {} });
  restore();
});

test('mapLimit keeps order and never runs more than n at a time', async () => {
  let now = 0; let peak = 0;
  const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (x) => { now += 1; peak = Math.max(peak, now); await new Promise((r) => setTimeout(r, 3)); now -= 1; return x * 2; });
  assert.deepEqual(out, [2, 4, 6, 8, 10, 12]);
  assert.equal(peak, 2);
});

test('generate: four slots, lines in the 11-14 and 11-15 files (never the clock\'s day), marked, no forecast, nothing sent to AWS', async () => {
  const dir = fixtures();
  const out = path.join(dir, 'out');
  const calls = [];
  const chat = stubChat(calls);
  const { code, logs } = await quietRun(['--data-dir', dir, '--out', out, '--cap', '5'], { chat, resolveProvider, now: () => REAL_NOW });
  assert.equal(code, 0, logs.join('\n'));
  // the steps are the three non-forecast ones, all on Anthropic, with the live caps
  assert.deepEqual([...new Set(calls.map((c) => c.step))].sort(), ['summary', 'topic_selection', 'trace_cause']);
  assert.ok(calls.every((c) => c.model === 'anthropic:claude-sonnet-5-5'));
  assert.deepEqual([...new Set(calls.filter((c) => c.step !== 'topic_selection').map((c) => c.maxTokens))], [1500]);
  assert.equal(calls.filter((c) => c.step === 'topic_selection').length, 4);
  assert.ok(chat.peak() <= 2, `calls in flight ${chat.peak()}`);
  // the day files: slot 1 in 11-14 (after the live line), slots 2-4 in 11-15; nothing in 11-16 or 11-17
  const files = fs.readdirSync(path.join(out, 'entries')).sort();
  assert.deepEqual(files, ['2026-11-14.jsonl', '2026-11-15.jsonl']);
  const d14 = readLines(path.join(out, 'entries', '2026-11-14.jsonl'));
  const d15 = readLines(path.join(out, 'entries', '2026-11-15.jsonl'));
  assert.equal(d14.length, 3, logs.join('\n'));
  assert.equal(d15.length, 9, logs.join('\n'));
  for (const l of [...d14, ...d15]) {
    assert.ok(Date.parse(l.writtenLate.writtenAt) - Date.parse(REAL_NOW) < 1000, 'the real time, not the slot');
    assert.equal(l.archivedAt, l.writtenLate.writtenAt);
    assert.equal(l.batch, l.writtenLate.writtenAt);
    assert.equal(l.ai.prediction, null, 'no forecast');
    assert.ok(l.ai.summary && l.ai.trace_cause);
  }
  assert.deepEqual([...new Set(d14.map((l) => l.writtenLate.slot))], [S1]);
  assert.deepEqual([...new Set(d15.map((l) => l.writtenLate.slot))], [S2, S3, S4]);
  assert.deepEqual(d15.map((l) => l.n), [0, 1, 2, 0, 1, 2, 0, 1, 2]);
  // each slot sees the earlier ones: its picks differ (the stub skips covered titles) and the seen-today list was in its prompt
  assert.equal(new Set([...d14, ...d15].map((l) => l.title)).size, 12);
  assert.match(fs.readFileSync(path.join(out, 'slots', '2026-11-15T0415', 'selection-prompt.txt'), 'utf8'), /PREVIOUSLY COVERED TODAY/);
  assert.match(fs.readFileSync(path.join(out, 'slots', '2026-11-14T2015', 'selection-prompt.txt'), 'utf8'), /Live story about Zulu/);
  // the pool never held a line first seen after its slot
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'slots', '2026-11-15T2015', 'selection-prompt.txt'), 'utf8'), /Echo \d+x/);
  // notes: a summary and a cause note per story, written at the real time, none for a forecast
  const notes = readLines(path.join(out, 'notes.jsonl'));
  assert.equal(notes.length, 24);
  assert.deepEqual([...new Set(notes.map((x) => x.part))].sort(), ['cause', 'summary']);
  assert.ok(notes.every((x) => x.at.startsWith('2026-11-17T02:00:0') && x.date === '2026-11-17' && x.model === 'claude-sonnet-5-5'));
  // the manifest: spend and counts
  const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.equal(m.usage.calls, 4 + 12 * 2);
  assert.equal(m.usage.requests, m.usage.calls);
  assert.equal(m.usage.usd, Number(((m.usage.calls * (1000 * 2 + 200 * 10)) / 1e6).toFixed(4)));
  assert.equal(m.days['2026-11-14'].liveLines, 1);
  assert.equal(m.days['2026-11-15'].replayedLines, 9);
  assert.ok(fs.existsSync(path.join(out, 'slots', '2026-11-14T2015', 'stories.md')));
});

test('generate: the replayed lines are what newsStoryRecord reads: the late entries replay into the day, after the live one', async () => {
  const dir = fixtures();
  const out = path.join(dir, 'out');
  await quietRun(['--data-dir', dir, '--out', out, '--slots', S1], { chat: stubChat(), resolveProvider, now: () => REAL_NOW });
  const live = readLines(path.join(dir, 'entries', '2026-11-14.jsonl'));
  const late = readLines(path.join(out, 'entries', '2026-11-14.jsonl'));
  const { entries } = inbox.replayDay([...live, ...late]);
  assert.deepEqual(entries.map((e) => !!e.writtenLate), [false, true, true, true]);
  assert.ok(entries.slice(1).every((e) => e.writtenLate.slot === S1 && e.threadId));
});

test('generate refuses a model that is not Anthropic before any call, and a run that would pass the cap stops', async () => {
  const dir = fixtures();
  const calls = [];
  const bad = await quietRun(['--data-dir', dir, '--out', path.join(dir, 'o1'), '--model', 'deepseek-v4-pro', '--slots', S1], { chat: stubChat(calls), resolveProvider, now: () => REAL_NOW }).catch((e) => e);
  assert.ok(bad instanceof Error && /refusing a call to deepseek/.test(bad.message), String(bad));
  assert.equal(calls.length, 0);
  const capped = await quietRun(['--data-dir', dir, '--out', path.join(dir, 'o2'), '--cap', '0.01', '--slots', S1], { chat: stubChat(calls), resolveProvider, now: () => REAL_NOW }).catch((e) => e);
  assert.ok(capped instanceof Error && /spend cap/.test(capped.message), String(capped));
  assert.equal(calls.length, 0);
});

test('generate: a selection that does not parse stops the run and says so; nothing is written to the day files', async () => {
  const dir = fixtures();
  const out = path.join(dir, 'out');
  const chat = async (opts) => ({ content: 'sorry, no json', model: 'm', usage: { prompt_tokens: 10, completion_tokens: 5 }, finishReason: 'stop', latencyMs: 1, step: opts.step });
  const { code } = await quietRun(['--data-dir', dir, '--out', out, '--slots', S1], { chat, resolveProvider, now: () => REAL_NOW });
  assert.equal(code, 2);
  const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.equal(m.slots[0].ok, false);
  assert.equal(m.slots[0].failures[0].stage, 'selection-parse');
  assert.deepEqual(fs.readdirSync(path.join(out, 'entries')), []);
});

// ---- the write mode --------------------------------------------------------------------------------------------------------------------
function fakeS3() {
  const objs = new Map();
  class Get { constructor(input) { this.input = input; } }
  class Put { constructor(input) { this.input = input; } }
  const err = (name, code) => Object.assign(new Error(name), { name, $metadata: { httpStatusCode: code } });
  const client = { send: async (c) => {
    const o = objs.get(c.input.Key);
    if (c instanceof Get) { if (!o) throw err('NoSuchKey', 404); return { Body: { transformToString: async () => o.body }, ETag: o.etag }; }
    if ((c.input.IfNoneMatch === '*' && o) || (c.input.IfMatch && (!o || o.etag !== c.input.IfMatch))) throw err('PreconditionFailed', 412);
    objs.set(c.input.Key, { body: c.input.Body, etag: `"e${objs.size}-${Math.random()}"` });
    return {};
  } };
  return { objs, s3json: makeS3Json({ client, GetObjectCommand: Get, PutObjectCommand: Put, bucket: 'b' }) };
}

test('write mode appends exactly the generated files under record/ (or record/shadow/), once, and refuses today\'s file or an unmarked line', async () => {
  const dir = fixtures();
  const out = path.join(dir, 'out');
  await quietRun(['--data-dir', dir, '--out', out], { chat: stubChat(), resolveProvider, now: () => REAL_NOW });
  const w = fakeS3();
  const first = await quietRun(['--write', '--out', out, '--shadow'], { s3json: w.s3json, now: () => REAL_NOW });
  assert.equal(first.code, 0);
  assert.deepEqual([...w.objs.keys()].sort(), ['record/shadow/inbox/entries/2026-11-14.jsonl', 'record/shadow/inbox/entries/2026-11-15.jsonl', 'record/shadow/notes/entry/2026-11-17.jsonl', 'record/shadow/notes/entry/manifest.json']);
  const lines = (k) => w.objs.get(k).body.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines('record/shadow/inbox/entries/2026-11-14.jsonl').length, 3);
  assert.equal(lines('record/shadow/inbox/entries/2026-11-15.jsonl').length, 9);
  assert.equal(lines('record/shadow/notes/entry/2026-11-17.jsonl').length, 24);
  const again = await quietRun(['--write', '--out', out, '--shadow'], { s3json: w.s3json, now: () => REAL_NOW });
  assert.equal(again.code, 0);
  assert.equal(lines('record/shadow/inbox/entries/2026-11-15.jsonl').length, 9, 'a second write appends nothing');
  // refusals
  await assert.rejects(() => main(['--write', '--out', out], { s3json: w.s3json, now: () => '2026-11-15T10:00:00.000Z' }), /refusing to write into today's, yesterday's or a later file/);
  const f = path.join(out, 'entries', '2026-11-14.jsonl');
  const bad = readLines(f);
  delete bad[0].writtenLate;
  fs.writeFileSync(f, bad.map((l) => JSON.stringify(l)).join('\n') + '\n');
  await assert.rejects(() => main(['--write', '--out', out], { s3json: w.s3json, now: () => REAL_NOW }), /without a writtenLate marker/);
});

test('no forecast path: neither module of the script loads the forecast, question or log code', () => {
  const here = path.dirname(new URL(import.meta.url).pathname);
  for (const f of ['recover-late-slots.mjs', 'recover-late-lib.mjs']) {
    const code = fs.readFileSync(path.join(here, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
    assert.equal(code.match(/forecast-draw|forecastsInbox|questions|PredictionLog|PRED#|buildPredictionPrompt|drawDecision|dynamodb/i), null, f);
    const hits = code.split('\n').filter((l) => /'prediction'|"prediction"/.test(l));
    assert.ok(hits.every((h) => f === 'recover-late-slots.mjs' && /throw new Error|FORECAST_KEYS/.test(h)), `${f}: only the write mode's refusals may name a forecast`);
  }
});

const generated = async (nowIso = REAL_NOW) => {
  const dir = fixtures();
  const out = path.join(dir, 'out');
  await quietRun(['--data-dir', dir, '--out', out], { chat: stubChat(), resolveProvider, now: () => nowIso });
  return { dir, out };
};

test('write mode refuses the file of UTC yesterday (the Today view reads it) and says when it becomes possible', async () => {
  const { out } = await generated();
  const w = fakeS3();
  // on 2026-11-16 UTC the 11-15 file is still read by index/today.json; the 11-14 file is not, but the whole write stops
  await assert.rejects(() => main(['--write', '--out', out], { s3json: w.s3json, now: () => '2026-11-16T20:00:00.000Z' }), /2026-11-15: refusing .*possible from 2026-11-17 00:00 UTC/);
  assert.equal(w.objs.size, 0, 'nothing appended');
  const ok = await quietRun(['--write', '--out', out], { s3json: w.s3json, now: () => '2026-11-17T00:00:00.000Z' });
  assert.equal(ok.code, 0);
});

test('write mode saves what an object holds before the first append, and stops when the copy cannot be written', async () => {
  const { out } = await generated();
  const w = fakeS3();
  const live = { inboxId: 'live|0', topicId: 'L-0', title: 'live', batch: '2026-11-14T12:26:00.000Z' };
  await w.s3json.appendLines('record/inbox/entries/2026-11-14.jsonl', [live], { idKey: 'inboxId' });
  // the backup folder cannot be created: a file sits where it must go
  fs.writeFileSync(path.join(out, 'backup'), 'in the way');
  await assert.rejects(() => main(['--write', '--out', out], { s3json: w.s3json, now: () => REAL_NOW }), /backup of .* could not be written .*nothing was appended/);
  assert.equal(w.objs.get('record/inbox/entries/2026-11-14.jsonl').body.trim().split('\n').length, 1, 'nothing appended');
  fs.unlinkSync(path.join(out, 'backup'));
  const r = await quietRun(['--write', '--out', out], { s3json: w.s3json, now: () => REAL_NOW });
  assert.equal(r.code, 0);
  assert.deepEqual(readLines(path.join(out, 'backup', 'record/inbox/entries/2026-11-14.jsonl')), [live]);
  assert.equal(fs.existsSync(path.join(out, 'backup', 'record/inbox/entries/2026-11-15.jsonl')), false, 'an object that did not exist has no backup');
});

test('write mode refuses a second generate run for slots already written, and any line with a forecast key', async () => {
  const first = await generated();
  const second = await generated('2026-11-17T05:00:00.000Z');
  const w = fakeS3();
  assert.equal((await quietRun(['--write', '--out', first.out], { s3json: w.s3json, now: () => '2026-11-18T00:00:00.000Z' })).code, 0);
  await assert.rejects(() => main(['--write', '--out', second.out], { s3json: w.s3json, now: () => '2026-11-18T00:00:00.000Z' }), /already holds \d+ late line\(s\) of the same slot with other inboxIds/);
  // the same out dir again is still a no-op
  assert.equal((await quietRun(['--write', '--out', first.out], { s3json: w.s3json, now: () => '2026-11-18T00:00:00.000Z' })).code, 0);
  for (const bad of [{ scenarios: [{}] }, { forecast: 'x' }, { prediction: 'p' }, { ai: { forecast: 'x' } }, { ai: { scenarios: [1] } }]) {
    const { out } = await generated();
    const f = path.join(out, 'entries', '2026-11-14.jsonl');
    const rows = readLines(f);
    Object.assign(rows[0], bad.ai ? { ai: { ...rows[0].ai, ...bad.ai } } : bad);
    fs.writeFileSync(f, rows.map((l) => JSON.stringify(l)).join('\n') + '\n');
    await assert.rejects(() => main(['--write', '--out', out], { s3json: fakeS3().s3json, now: () => '2026-11-18T00:00:00.000Z' }), /carries a forecast/, JSON.stringify(bad));
  }
});
