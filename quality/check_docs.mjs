// check_docs — doc layout guard (project-docs/decisions/0025-docs-storage-layout.md).
// Fails (exit 1) when: project-docs/INDEX.md is over 60 lines, links to a file that does not exist
// a doc in project-docs/plans/ says `Status: done`; CLAUDE.md is over 80 lines.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'project-docs');
const INDEX = path.join(DOCS, 'INDEX.md');
const lineCount = (file) => fs.readFileSync(file, 'utf8').replace(/\n$/, '').split('\n').length;

export function checkDocs() {
  const problems = [];
  const index = fs.readFileSync(INDEX, 'utf8');
  const n = lineCount(INDEX);
  if (n > 60) problems.push(`INDEX.md has ${n} lines (max 60)`);
  for (const [, target] of index.matchAll(/\]\(<?([^)\s>]+)>?\)/g)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const rel = target.split('#')[0];
    const abs = path.resolve(DOCS, rel);
    if (!fs.existsSync(abs)) problems.push(`INDEX.md links to a missing file: ${target}`);
  }
  const plans = path.join(DOCS, 'plans');
  for (const f of fs.existsSync(plans) ? fs.readdirSync(plans) : []) {
    if (!f.endsWith('.md')) continue;
    const done = fs.readFileSync(path.join(plans, f), 'utf8').split('\n')
      .find((l) => /^[\s>*_]*status[*_\s]*:[*_\s]*(done|shipped|cancelled)\b/i.test(l));
    if (done) problems.push(`plans/${f} says "${done.trim()}" — record its decisions in decisions/ and delete it`);
  }
  const claude = lineCount(path.join(ROOT, 'CLAUDE.md'));
  if (claude > 80) problems.push(`CLAUDE.md has ${claude} lines (max 80)`);
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
