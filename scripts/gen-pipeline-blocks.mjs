#!/usr/bin/env node
// Renders the pipeline block into every backend group and frontend feature README from the one source,
// project-docs/architecture/pipeline.json. The block sits between <!-- pipeline:begin --> and <!-- pipeline:end -->
// (inserted after the intro paragraph when missing) and replaces the older one-line "Timeline:" line.
//   node scripts/gen-pipeline-blocks.mjs          # write blocks
//   node scripts/gen-pipeline-blocks.mjs --check  # exit 1 if any block is missing or stale (used by check_docs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'project-docs/architecture/pipeline.json');
const BEGIN = '<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->';
const END = '<!-- pipeline:end -->';

export function readmePath(folder) {
  return folder.startsWith('features/')
    ? path.join(ROOT, 'global-perspectives-starter/frontend/src', folder, 'README.md')
    : path.join(ROOT, folder, 'README.md');
}

function docLink(folder) {
  const rel = path.relative(path.dirname(readmePath(folder)), path.join(ROOT, 'project-docs/architecture/ARCHITECTURE_TIMELINE.md'));
  return `[ARCHITECTURE_TIMELINE.md](${rel.split(path.sep).join('/')})`;
}

export function renderBlock(spec, folder) {
  const f = spec.folders[folder];
  const chain = spec.stages.map((s) => (f.stages.includes(s.n) ? `**${s.n} ${s.name}**` : `${s.n} ${s.name}`)).join(' → ');
  const where = f.stages.length ? `This folder is stage ${f.stages.join(', ')}: ${f.part}.` : `This folder is outside the pipeline: ${f.part}.`;
  return [BEGIN, `Pipeline: ${chain}`, `${where} Timeline: ${f.timeline}. See ${docLink(folder)}.`, END].join('\n');
}

const blockRe = /<!-- pipeline:begin[^>]*-->[\s\S]*?<!-- pipeline:end -->/;

export function apply(text, block) {
  if (blockRe.test(text)) return text.replace(blockRe, block);
  const withoutTimeline = text.replace(/\nTimeline: [^\n]*\n/, '\n');
  const m = withoutTimeline.match(/\n## /);
  if (!m) return `${withoutTimeline.replace(/\n*$/, '')}\n\n${block}\n`;
  const head = withoutTimeline.slice(0, m.index).replace(/\n+$/, '');
  return `${head}\n\n${block}\n${withoutTimeline.slice(m.index)}`;
}

export function run({ check = false } = {}) {
  const spec = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const problems = [];
  for (const folder of Object.keys(spec.folders)) {
    const file = readmePath(folder);
    if (!fs.existsSync(file)) continue; // a folder that does not exist yet (e.g. backend/record before its merge)
    const text = fs.readFileSync(file, 'utf8');
    const next = apply(text, renderBlock(spec, folder));
    if (next === text) continue;
    if (check) problems.push(`${folder}/README.md: pipeline block missing or stale (run node scripts/gen-pipeline-blocks.mjs)`);
    else fs.writeFileSync(file, next);
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = run({ check: process.argv.includes('--check') });
  if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
  console.log(process.argv.includes('--check') ? 'pipeline blocks: current' : 'pipeline blocks: written');
}
