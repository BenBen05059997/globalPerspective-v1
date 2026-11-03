#!/usr/bin/env node
// Preview what newsSituationTracker would group THIS sweep, from the live inputs. Read-only:
// S3 GETs and one `lambda get-function-configuration` through the AWS CLI; no writes, no invoke, no shadow
// state. It runs the tracker's own planNews (planNewsSituations + planNewsGrouping) on
//   stories/index.json (same eligibility filter as the tracker), threads/story-map.json,
//   situations/index.json + situations/state/<id>.json (the LIVE prefixes), situations/inbox/gdacs-latest.json.
//
//   node scripts/preview-news-grouping-live.mjs [--out preview.md] [--min-urls 2]
//
// Bucket and story-eligibility knobs come from the live Lambda env (WORLD_BUCKET, STORY_MAP_*), else the
// tracker's code defaults. Needs AWS CLI credentials with read access.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tracker = require('../backend/situations/newsSituationTracker/src/index.js');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const REGION = 'ap-northeast-1';
const aws = (...a) => execFileSync('aws', [...a, '--region', REGION], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const cfg = JSON.parse(aws('lambda', 'get-function-configuration', '--function-name', 'newsSituationTracker', '--query', 'Environment.Variables', '--output', 'json') || '{}') || {};
const BUCKET = cfg.WORLD_BUCKET || process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const num = (v, d) => Number(v) || d;
const minOutlets = num(cfg.STORY_MAP_MIN_OUTLETS, 3); const minSev = num(cfg.STORY_MAP_MIN_SEVERITY, 4); const cap = num(cfg.STORY_MAP_CAP, 40);
const getJson = (key) => {
  try { return JSON.parse(execFileSync('aws', ['s3', 'cp', `s3://${BUCKET}/${key}`, '-', '--region', REGION], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })); } catch { return null; }
};
const stateKey = (id) => id.replace(/[^A-Za-z0-9._-]/g, '_');

const idx = getJson('stories/index.json');
const stories = ((idx && idx.stories) || []).filter((s) => s.centroid && s.axis && (s.outlets >= minOutlets || s.max_severity >= minSev)).slice(0, cap);
const storyMap = (getJson('threads/story-map.json') || {}).pairs || {};
const index = getJson('situations/index.json') || { ids: [] };
const priors = {};
for (const id of index.ids) { const st = getJson(`situations/state/${stateKey(id)}.json`); if (st) priors[id] = st; }
const gdacsIso = new Set();
const snap = getJson('situations/inbox/gdacs-latest.json');
const gdacsDegraded = !snap || snap.degraded === true || !Array.isArray(snap.events);
if (!gdacsDegraded) for (const o of snap.events) for (const c of o.iso3_affected || []) gdacsIso.add(c);
else for (const st of Object.values(priors)) if (st.source === 'gdacs' && st.state !== 'closed') for (const c of st.iso3_affected || []) gdacsIso.add(c);

const plain = tracker._internal.planNews(stories, priors, storyMap, gdacsIso, { grouping: false });
const plan = tracker._internal.planNews(stories, priors, storyMap, gdacsIso, { grouping: true, minSharedUrls: args['min-urls'] ? Number(args['min-urls']) : undefined });

const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const evidence = (r) => (r.rule === 'url' ? `${r.sharedCount} shared: ${r.urls.join(' ; ')}` : r.rule === 'title+country' ? `"${r.title}" in ${r.countries.join(', ')}` : `member story ${r.storyId}`);
const out = [];
out.push('# Live grouping preview (read-only)');
out.push('');
out.push(`Inputs read ${new Date().toISOString()}: stories/index.json updated_at ${idx && idx.updated_at}, ${stories.length} eligible stories (>=${minOutlets} outlets or severity >=${minSev}, cap ${cap}), ${Object.keys(priors).length} situations in live state, bucket ${BUCKET}.`);
out.push(`Groups this sweep: ${plain.groups.length} without grouping, ${plan.groups.length} with grouping; ${plan.merges.length} join(s); absorbed prior states: ${plan.absorbed.length}.`);
out.push('Live states carry no member_urls yet, so a situation is compared by its current evidence headlines (and title / countries).');
out.push('');
out.push('| Survivor id | Survivor title | Absorbed id | Absorbed title | Rule | Evidence |');
out.push('|---|---|---|---|---|---|');
for (const r of plan.merges) out.push(`| ${cell(r.survivor.id)} | ${cell(r.survivor.title)} | ${cell(r.absorbed.id)} | ${cell(r.absorbed.title)} | ${r.rule} | ${cell(evidence(r))} |`);
if (!plan.merges.length) out.push('| (no joins) | | | | | |');
const text = out.join('\n') + '\n';
if (args.out) fs.writeFileSync(args.out, text);
process.stdout.write(text);
