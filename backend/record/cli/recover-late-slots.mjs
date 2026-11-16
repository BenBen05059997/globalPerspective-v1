#!/usr/bin/env node
// One-off recovery of the four news runs a model outage lost: 2026-11-14 20:15 UTC and 2026-11-15 04:15, 12:15, 20:15 (decision 0061).
// Runs from a laptop. The live Lambdas (newsIngest, newsAgent) are not invoked and get no replay mode: this script runs their own functions
// (newsInvokeGemini/src/selection.js, NewsProjectInvokeAgentLambda/src/story-text.js) on the articles saved in record/inbox/articles/.
//
// Two modes. Neither touches DynamoDB, neither generates a forecast (no forecast function is called; the only model steps are topic_selection,
// summary and trace_cause).
//   generate (default)   Per slot: rebuild the article pool as of the slot, select topics, write a summary and a cause note per topic, all
//                        through the shared chat() on an Anthropic model. WRITES NOTHING TO AWS: the would-be inbox lines, notes, topics and
//                        usage go to --out (default recovery-late-out/). Reads the saved articles and entries from --data-dir (local copies,
//                        so no AWS call at all) or, without it, read-only from S3 (--bucket). The key is read from --key-file into the
//                        process env and never printed.
//   --write --out DIR    Appends exactly the files of an earlier generate run (the ones the operator read) to record/inbox/entries/DAY.jsonl
//                        and record/notes/entry/ (record/shadow/ with --shadow). No model call. Idempotent per out dir only: the same inboxId /
//                        noteId appends nothing, but a second generate makes new inboxIds, so write the files of ONE generate run; the write
//                        refuses when the target day file already holds late lines of the same slot with other inboxIds. Before the first append
//                        to each object it saves the object's current content under OUT/backup/<key> (the bucket has no versioning) and refuses
//                        to go on if that fails. It refuses a day file the Today view still reads: index/today.json reads the inbox files of
//                        the last two UTC days (publish.js readTodayInbox) and keeps entries archived within 24 h of the newest write, so a late
//                        line in the file of UTC yesterday or today would show as fresh; a day D can be written from D+2 00:00 UTC. It also
//                        refuses a line without the marker or with any forecast key. Then run newsStoryRecord for the two days (decision 0061).
// Every entry line carries writtenLate {writtenAt: the real write time, slot: the missed run}. Day keys come from the slot, never from the clock.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';
import { SLOTS, dayOf, addDays, replaySlot, addReplayed, dayReplay, makeMeter, captureUsage } from './recover-late-lib.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const notesLib = require('../../shared/src/notes.js');
const prices = require('../../monitoring/newsHealth/src/prices.json');

const MODEL = 'anthropic:claude-sonnet-5-5'; // the live GROK_MODEL of newsIngest and newsAgent (read 2026-11-17)
const AGENT_MAX_TOKENS = '1500'; // the live newsAgent MAX_TOKENS (decision 0060)
const LIMIT = 13; // TOPICS_LIMIT as decision 0060 records it
const OUT_FILES = { manifest: 'manifest.json', notes: 'notes.jsonl', usage: 'usage.jsonl' };

const jsonl = (lines) => lines.map((l) => JSON.stringify(l)).join('\n') + (lines.length ? '\n' : '');
const readJsonl = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : []);

function loadS3(bucket) {
  const sdk = requireSdk('@aws-sdk/client-s3');
  return makeS3Json({ client: new sdk.S3Client({ region: REGION }), GetObjectCommand: sdk.GetObjectCommand, PutObjectCommand: sdk.PutObjectCommand, bucket });
}

/** Where the saved articles and entries come from: local copies (--data-dir, no AWS) or read-only S3. */
function makeReader({ dataDir, bucket }) {
  if (dataDir) return { source: `dir ${dataDir}`, lines: async (kind, day) => readJsonl(path.join(dataDir, kind, `${day}.jsonl`)) };
  if (!bucket) throw new Error('give --data-dir (local copies) or --bucket / WORLD_BUCKET (read-only S3)');
  const s3 = loadS3(bucket);
  return { source: `s3 ${bucket} (read only)`, lines: async (kind, day) => (await s3.getLines(`record/inbox/${kind}/${day}.jsonl`)).lines };
}

export function storiesMarkdown(r) {
  const head = `# Slot ${r.slot}\n\nPool ${r.pool.pool} articles (${r.promptArticles} in the prompt). ${r.topicTitles.length} topics, ${r.stories.length} stories written.\n`;
  const body = r.stories.map((s, i) => `\n## ${i + 1}. ${s.title}\n\n${s.category} | thread ${s.threadId}\n\n**Summary**\n\n${s.summary || '(none)'}\n\n**Cause note**\n\n${s.cause || '(none)'}\n\n**Sources**\n\n${s.sources.map((x) => `- ${x.outlet || x.source}: ${x.title} (${x.url})`).join('\n')}\n`).join('');
  return head + body;
}

/** The real clock, never the same instant twice: a slot's `batch` is its lines' inboxId prefix, and a repeated one would make the append drop lines. */
function strictlyIncreasing(now) {
  let last = 0;
  return () => { last = Math.max(Date.parse(now()), last + 1); return new Date(last).toISOString(); };
}

/** The generate mode. `deps` = { chat, resolveProvider, now } (injected by tests). */
async function generate(v, deps0) {
  const deps = { ...deps0, now: strictlyIncreasing(deps0.now) };
  const slots = v.slots ? v.slots.split(',') : SLOTS;
  const cap = Number(v.cap);
  const out = path.resolve(v.out);
  fs.mkdirSync(path.join(out, 'entries'), { recursive: true });
  const reader = makeReader({ dataDir: v['data-dir'], bucket: v.bucket || process.env.WORLD_BUCKET });
  const meter = makeMeter({ chat: deps.chat, resolveProvider: deps.resolveProvider, prices, capUsd: cap, maxInFlight: 2 });
  const restore = captureUsage(meter);
  const manifest = { kind: 'recover-late-slots', decision: '0061', startedAt: deps.now(), source: reader.source, model: v.model, limit: Number(v.limit), capUsd: cap, slots: [], days: {} };
  const liveByDay = {};
  const replayed = {};
  const allNotes = [];
  let exit = 0;
  try {
    console.log(`generate (no AWS write): ${slots.join(', ')}; out ${out}`);
    for (const slot of slots) {
      const slotMs = Date.parse(slot);
      if (!Number.isFinite(slotMs)) throw new Error(`bad slot ${slot}`);
      const articleLines = [];
      for (let i = 3; i >= 0; i--) articleLines.push(...await reader.lines('articles', addDays(dayOf(slot), -i)));
      for (let i = 8; i >= 0; i--) { const d = addDays(dayOf(slot), -i); if (!(d in liveByDay)) liveByDay[d] = await reader.lines('entries', d); }
      console.log(`\n== ${slot}: ${articleLines.length} saved article lines`);
      const r = await replaySlot({
        slot, articleLines, liveByDay, replayed, deps: { call: meter.call, now: deps.now },
        cfg: { limit: Number(v.limit), selectionModel: v.model, agentModel: v.model, agentEnv: { MAX_TOKENS: v['max-tokens'] }, concurrency: 2 },
      });
      const dir = path.join(out, 'slots', r.tag);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'selection-prompt.txt'), r.selectionPrompt || '');
      fs.writeFileSync(path.join(dir, 'selection-reply.txt'), r.selectionReply || '');
      const summary = {
        slot, ok: r.ok, pool: r.pool, window: r.window, promptArticles: r.promptArticles, selectionFinish: r.selectionFinish, selection: r.selection,
        topics: r.topicTitles, skippedNoText: r.skippedNoText, entriesWritten: r.lines ? r.lines.length : 0, notes: r.notes ? r.notes.length : 0, failures: r.failures,
      };
      fs.writeFileSync(path.join(dir, 'slot.json'), `${JSON.stringify(summary, null, 2)}\n`);
      if (r.ok) fs.writeFileSync(path.join(dir, 'stories.md'), storiesMarkdown(r));
      manifest.slots.push({ ...summary, usageSoFar: { requests: meter.state.requests, usd: Number(meter.state.usd.toFixed(4)) } });
      console.log(`   pool ${r.pool.pool} (${r.promptArticles} in the prompt) -> ${r.selection ? r.selection.topics : 0} topics, ${summary.entriesWritten} entries, ${summary.failures.length} failure(s); spent ${meter.state.usd.toFixed(3)} USD`);
      if (!r.ok) { console.log(`   slot failed (${r.failures.map((f) => f.message).join('; ')}); later slots depend on it, stopping`); exit = 2; break; }
      // the lines join the day file in slot order and the next slot sees them (its seen-today list, its titles, its threading window)
      addReplayed(replayed, r.day, r.lines);
      allNotes.push(...r.notes);
      for (const day of Object.keys(replayed)) {
        fs.writeFileSync(path.join(out, 'entries', `${day}.jsonl`), jsonl(replayed[day]));
        manifest.days[day] = { replayedLines: replayed[day].length, liveLines: (liveByDay[day] || []).filter((l) => !l.writtenLate).length, ...dayReplay([...(liveByDay[day] || []).filter((l) => !l.writtenLate), ...replayed[day]]) };
      }
      fs.writeFileSync(path.join(out, OUT_FILES.notes), jsonl(allNotes));
    }
  } finally {
    restore();
  }
  manifest.finishedAt = deps.now();
  manifest.usage = { requests: meter.state.requests, calls: meter.state.calls, retries: meter.state.requests - meter.state.calls, promptTokens: meter.state.promptTokens, completionTokens: meter.state.completionTokens, usd: Number(meter.state.usd.toFixed(4)), byStep: meter.state.byStep, peakInFlight: meter.state.peakInFlight };
  fs.writeFileSync(path.join(out, OUT_FILES.usage), jsonl(meter.state.log));
  fs.writeFileSync(path.join(out, OUT_FILES.manifest), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\ndone: ${meter.state.requests} requests (${meter.state.calls} calls), ${meter.state.promptTokens} in / ${meter.state.completionTokens} out tokens, ${meter.state.usd.toFixed(3)} USD; files in ${out}`);
  return exit;
}

const FORECAST_KEYS = ['prediction', 'forecast', 'scenarios'];
const hasForecast = (l) => FORECAST_KEYS.some((k) => l[k]) || (l.ai && typeof l.ai === 'object' && FORECAST_KEYS.some((k) => l.ai[k]));

/** Save what the object holds now to OUT/backup/<key> before the first append (nothing to save when it does not exist). Throws when the copy cannot be written. */
async function backupObject(s3, out, key, kind) {
  let text = '';
  if (kind === 'json') { const o = await s3.getJson(key); text = o === null ? '' : `${JSON.stringify(o)}\n`; }
  else { const { lines } = await s3.getLines(key); text = lines.length ? `${lines.map((l) => JSON.stringify(l)).join('\n')}\n` : ''; }
  if (!text) return { key, existed: false };
  const file = path.join(out, 'backup', key);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    if (fs.statSync(file).size !== Buffer.byteLength(text)) throw new Error('size differs');
  } catch (e) { throw new Error(`backup of ${key} could not be written (${e.message}): nothing was appended`); }
  return { key, existed: true, file };
}

/** The write mode: the files of an earlier generate run -> the inbox and the entry notes. No model, no key. */
async function writeOut(v, deps) {
  const out = path.resolve(v.out);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, OUT_FILES.manifest), 'utf8'));
  if (manifest.kind !== 'recover-late-slots') throw new Error(`${out} is not the output of this script`);
  const slotDays = new Set(manifest.slots.filter((s) => s.ok).map((s) => dayOf(s.slot)));
  const today = dayOf(deps.now());
  const prefix = v.shadow ? 'record/shadow/' : 'record/';
  const bucket = v.bucket || process.env.WORLD_BUCKET;
  if (!bucket && !deps.s3json) throw new Error('--write needs --bucket or WORLD_BUCKET');
  const files = fs.readdirSync(path.join(out, 'entries')).filter((f) => f.endsWith('.jsonl')).sort();
  const plan = files.map((f) => ({ day: f.slice(0, -6), lines: readJsonl(path.join(out, 'entries', f)) }));
  for (const { day, lines } of plan) {
    if (!slotDays.has(day)) throw new Error(`${day}: not the day of a generated slot`);
    // index/today.json reads the inbox files of the last two UTC days and shows entries archived within 24 h of the newest write: the file of UTC yesterday or today must stay untouched
    if (day >= addDays(today, -1)) throw new Error(`${day}: refusing to write into today's, yesterday's or a later file (the Today view still reads it and would show these stories as new); possible from ${addDays(day, 2)} 00:00 UTC`);
    for (const l of lines) {
      if (!l.writtenLate || dayOf(l.writtenLate.slot) !== day) throw new Error(`${day}: a line without a writtenLate marker for this day (${l.inboxId})`);
      if (hasForecast(l)) throw new Error(`${day}: a line carries a forecast (${l.inboxId})`);
    }
  }
  const noteLines = readJsonl(path.join(out, OUT_FILES.notes));
  for (const n of noteLines) if (n.subtype !== 'entry' || n.part === 'prediction') throw new Error(`notes: ${n.noteId} is not a summary or cause note`);
  const s3 = deps.s3json || loadS3(bucket);
  // a second generate run has other inboxIds: refuse when the target already holds late lines of the same slot that are not these
  for (const { day, lines } of plan) {
    const ours = new Set(lines.map((l) => l.inboxId));
    const slots = new Set(lines.map((l) => l.writtenLate.slot));
    const clash = (await s3.getLines(`${prefix}inbox/entries/${day}.jsonl`)).lines.filter((l) => l.writtenLate && slots.has(l.writtenLate.slot) && !ours.has(l.inboxId));
    if (clash.length) throw new Error(`${day}: the file already holds ${clash.length} late line(s) of the same slot with other inboxIds (an earlier generate run was written); not appending a second set`);
  }
  console.log(`WRITE to ${bucket}/${prefix}: ${plan.map((p) => `${p.day} ${p.lines.length} lines`).join(', ')}; ${noteLines.length} notes`);
  // every object this write appends to is saved first; one failed copy stops the whole write before any append
  const noteDays = [...new Set(noteLines.map((n) => n.date))].sort();
  const backups = [];
  for (const { day } of plan) backups.push(await backupObject(s3, out, `${prefix}inbox/entries/${day}.jsonl`, 'lines'));
  for (const d of noteDays) backups.push(await backupObject(s3, out, `${prefix}notes/entry/${d}.jsonl`, 'lines'));
  backups.push(await backupObject(s3, out, `${prefix}notes/entry/manifest.json`, 'json'));
  console.log(`  backups: ${backups.filter((b) => b.existed).length} saved under ${path.join(out, 'backup')}, ${backups.filter((b) => !b.existed).length} object(s) did not exist`);
  for (const { day, lines } of plan) {
    const r = await s3.appendLines(`${prefix}inbox/entries/${day}.jsonl`, lines, { idKey: 'inboxId' });
    console.log(`  ${prefix}inbox/entries/${day}.jsonl: ${r.appended} appended, ${r.skipped} already there`);
  }
  const w = await notesLib.makeNoteWriter({ s3json: s3, prefix }).write('entry', noteLines);
  console.log(`  ${prefix}notes/entry/: ${w.appended} appended, ${w.skipped} already there (days ${w.days.join(', ')})`);
  return 0;
}

export async function main(argv = process.argv.slice(2), injected = {}) {
  const { values: v } = parseArgs({
    args: argv,
    options: {
      'data-dir': { type: 'string' }, out: { type: 'string', default: 'recovery-late-out' }, slots: { type: 'string' }, limit: { type: 'string', default: String(LIMIT) },
      model: { type: 'string', default: MODEL }, 'max-tokens': { type: 'string', default: AGENT_MAX_TOKENS }, cap: { type: 'string', default: '5' },
      'key-file': { type: 'string', default: path.join(os.homedir(), '.gp-anthropic-key.txt') },
      write: { type: 'boolean', default: false }, shadow: { type: 'boolean', default: false }, bucket: { type: 'string' },
    },
  });
  const now = injected.now || (() => new Date().toISOString());
  if (v.write) return writeOut(v, { now, s3json: injected.s3json });
  let chat = injected.chat;
  let resolveProvider = injected.resolveProvider;
  if (!chat) {
    // the key goes into this process's env for llm.js and nowhere else: it is not printed, logged or passed on
    const key = fs.readFileSync(v['key-file'], 'utf8').trim();
    if (!key) throw new Error(`${v['key-file']} is empty`);
    process.env.ANTHROPIC_API_KEY = key;
    ({ chat, resolveProvider } = require('../../shared/src/llm.js'));
  }
  return generate(v, { chat, resolveProvider, now });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
