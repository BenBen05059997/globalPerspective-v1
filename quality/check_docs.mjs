// check_docs: doc layout guard (project-docs/decisions/0041-docs-slimmed-to-architecture-decisions-readmes.md).
// Fails (exit 1) when: project-docs/START_HERE.md is missing, over 80 lines or links to a file that does not exist;
// CLAUDE.md is over 80 lines; a frontend feature folder has no README.md front door (over 80 lines or missing one of
// README_SECTIONS); a backend group has no README.md; a folder is missing from architecture/pipeline.json or its
// generated pipeline block is stale.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as pipelineBlocks } from '../scripts/gen-pipeline-blocks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'project-docs');
const START = path.join(DOCS, 'START_HERE.md');
const FEATURES = path.join(ROOT, 'global-perspectives-starter/frontend/src/features');
export const README_SECTIONS = ['Status', 'Routes', 'Frontend', 'Backend', 'Data', 'Pipeline', 'Docs', 'How to check it'];
const lineCount = (file) => fs.readFileSync(file, 'utf8').replace(/<!-- pipeline:begin[^>]*-->[\s\S]*?<!-- pipeline:end -->\n?/, '').replace(/\n$/, '').split('\n').length;

export function checkDocs() {
  const problems = [];
  if (!fs.existsSync(START)) problems.push('project-docs/START_HERE.md is missing');
  else {
    const start = fs.readFileSync(START, 'utf8');
    const n = lineCount(START);
    if (n > 80) problems.push(`START_HERE.md has ${n} lines (max 80)`);
    for (const [, target] of start.matchAll(/\]\(<?([^)\s>]+)>?\)/g)) {
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const rel = target.split('#')[0];
      const abs = path.resolve(DOCS, rel);
      if (!fs.existsSync(abs)) problems.push(`START_HERE.md links to a missing file: ${target}`);
    }
  }
  const claude = lineCount(path.join(ROOT, 'CLAUDE.md'));
  if (claude > 80) problems.push(`CLAUDE.md has ${claude} lines (max 80)`);
  for (const name of fs.readdirSync(FEATURES).filter((d) => fs.statSync(path.join(FEATURES, d)).isDirectory())) {
    const readme = path.join(FEATURES, name, 'README.md');
    if (!fs.existsSync(readme)) { problems.push(`features/${name} has no README.md`); continue; }
    const text = fs.readFileSync(readme, 'utf8');
    const lines = lineCount(readme);
    if (lines > 80) problems.push(`features/${name}/README.md has ${lines} lines (max 80)`);
    const missing = README_SECTIONS.filter((h) => !text.includes(`\n## ${h}\n`));
    if (missing.length) problems.push(`features/${name}/README.md lacks section(s): ${missing.join(', ')}`);
  }
  const BACKEND = path.join(ROOT, 'backend');
  for (const g of fs.readdirSync(BACKEND).filter((d) => fs.statSync(path.join(BACKEND, d)).isDirectory())) {
    const readme = path.join(BACKEND, g, 'README.md');
    if (!fs.existsSync(readme)) { problems.push(`backend/${g} has no README.md`); continue; }
  }
  const pipeline = JSON.parse(fs.readFileSync(path.join(DOCS, 'architecture/pipeline.json'), 'utf8')).folders;
  const folders = [
    ...fs.readdirSync(BACKEND).filter((d) => fs.statSync(path.join(BACKEND, d)).isDirectory()).map((d) => `backend/${d}`),
    ...fs.readdirSync(FEATURES).filter((d) => fs.statSync(path.join(FEATURES, d)).isDirectory()).map((d) => `features/${d}`),
  ];
  for (const f of folders) if (!pipeline[f]) problems.push(`${f} is not in project-docs/architecture/pipeline.json (add its stage and part)`);
  problems.push(...pipelineBlocks({ check: true }));
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkDocs();
  if (problems.length) {
    console.log(`check_docs: ${problems.length} problem(s)`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  console.log('check_docs: OK');
}
