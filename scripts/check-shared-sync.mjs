#!/usr/bin/env node
/**
 * Shared-module drift guard (ONE_TRUTH_EXECUTION_PLAN.md Phase 1).
 *
 * This repo has no Lambda layers — each function is a separate manual-deploy
 * unit. Backend helpers used by several Lambdas (llm.js, placeFilter.js + name
 * tables, dayZero.js, riskDimensions.js, situations-core.js) have ONE copy in
 * backend/shared/src, reached through each Lambda's committed
 * src/_shared symlink and zipped as real files by scripts/lambda.sh — those need
 * no check. What is left are copies that cross a bundle boundary (frontend vs
 * Lambda) or differ by design; when one is edited and its sibling isn't, the two
 * silently diverge with no build step or import graph to catch it. This script
 * is the catch:
 *   (a) country_facts.json              — structural JSON compare, excluding
 *                                          only _meta.description / _meta.sync
 *   (b) entity-normalization block      — require() both + compare exports
 *                                          (normalizeEntity source; ACTOR_ALIASES
 *                                          and the two regexes are NOT exported
 *                                          by either side, so those three are
 *                                          compared via marker-based text
 *                                          extraction from source instead — see
 *                                          extractUnexported() below)
 *
 *   (c) country identity                — the one country table (iso3Names.json) is byte-identical to
 *                                          the frontend data copy, and the resolver
 *                                          core (between the markers) in backend/shared/src/countries.js ==
 *                                          frontend shared/lib/countries.js
 *   (d) link rules                      — the address-building core (between the markers) in
 *                                          backend/shared/src/links.js == frontend shared/lib/links.js
 *   (f) board rules                     — the drawing/pairing core (between the markers) in
 *                                          backend/shared/src/record.js == frontend shared/lib/board.js
 *   (g) weekly sections                 — the section-model core (between the markers) in
 *                                          backend/weekly/sections.js == frontend features/weekly/lib/sections.js
 *   (e) Studio share modules, sampleRuleGolden.json — byte-identical frontend/Lambda copies
 *
 * It only reads files (plus writes to a throwaway os.tmpdir() dir in --self-test
 * mode). It never touches the checked files themselves.
 *
 * Usage:
 *   node scripts/check-shared-sync.mjs             # check the live repo
 *   node scripts/check-shared-sync.mjs --self-test  # prove the guard can fail
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dir, '..');
const abs = (p) => path.join(ROOT, p);
const req = createRequire(import.meta.url);
// Lambda folder name -> repo dir (backend/<group>/<name>), from scripts/functions.json.
const FN_DIRS = Object.fromEntries(Object.values(req('./functions.json').functions)
  .filter((f) => f.dir).map((f) => [path.basename(f.dir), f.dir]));
const fnPath = (name, rel) => { if (!FN_DIRS[name]) throw new Error(`${name} not in scripts/functions.json`); return abs(`${FN_DIRS[name]}/${rel}`); };

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function unifiedDiff(pathA, pathB) {
  try {
    return execFileSync('diff', ['-u', pathA, pathB], { encoding: 'utf8' });
  } catch (err) {
    // `diff` exits 1 (differing) or 2 (error) — stdout still carries the diff.
    return (err.stdout && err.stdout.toString()) || String(err.message || err);
  }
}

function textDiff(labelA, contentA, labelB, contentB) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-sync-diff-'));
  const fa = path.join(dir, path.basename(labelA));
  const fb = path.join(dir, path.basename(labelB));
  fs.writeFileSync(fa, contentA);
  fs.writeFileSync(fb, contentB);
  const d = unifiedDiff(fa, fb);
  fs.rmSync(dir, { recursive: true, force: true });
  return d;
}

/** Deep-compare two JSON-parsed values, excluding `description`/`sync` keys
 *  anywhere in the tree (those must merely exist on both sides, not match). */
function jsonStructuralDiff(a, b, pathPrefix = '') {
  const diffs = [];
  const walk = (x, y, p) => {
    const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
    if (isObj(x) && isObj(y)) {
      const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
      for (const k of keys) {
        const kp = p ? `${p}.${k}` : k;
        if (k === 'description' || k === 'sync') {
          const hasA = Object.prototype.hasOwnProperty.call(x, k);
          const hasB = Object.prototype.hasOwnProperty.call(y, k);
          if (!hasA || !hasB) diffs.push(`${kp}: must exist on both sides (present: A=${hasA} B=${hasB})`);
          continue;
        }
        if (!(k in x)) { diffs.push(`${kp}: missing on A`); continue; }
        if (!(k in y)) { diffs.push(`${kp}: missing on B`); continue; }
        walk(x[k], y[k], kp);
      }
    } else if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) {
        diffs.push(`${p}: array length differs (A=${x.length} B=${y.length})`);
        return;
      }
      x.forEach((v, i) => walk(v, y[i], `${p}[${i}]`));
    } else if (JSON.stringify(x) !== JSON.stringify(y)) {
      diffs.push(`${p}: A=${JSON.stringify(x)} !== B=${JSON.stringify(y)}`);
    }
  };
  walk(a, b, pathPrefix);
  return diffs;
}

/** Marker-based extraction for symbols that exist in source but are NOT
 *  module.exports'd by one or both sides (ACTOR_ALIASES, ENTITY_TITLE_PREFIX,
 *  ENTITY_ORG_SUFFIX). Grabs the `const NAME = <literal>;` statement verbatim
 *  and evaluates just that literal in isolation (no requires, no I/O) so we
 *  can compare actual values (JSON.stringify / .source), matching the plan's
 *  intent even though require() can't reach these symbols directly. */
function extractUnexported(source, name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*([\\s\\S]*?);\\n`, 'm');
  const m = source.match(re);
  if (!m) return { found: false };
  const literalSrc = m[1];
  // eslint-disable-next-line no-new-func
  const value = new Function(`return (${literalSrc});`)();
  return { found: true, literalSrc: literalSrc.trim(), value };
}

// ---------------------------------------------------------------------------
// the pair checks — each takes explicit paths so --self-test can point them
// at perturbed temp copies instead of the live repo files.
// ---------------------------------------------------------------------------

const SHARED = 'backend/shared/src'; // the one backend copy (see header)

/** N files must all be byte-identical to the first one (zero tolerance). */
function checkAllIdentical(paths) {
  const base = fs.readFileSync(paths[0]);
  for (const p of paths.slice(1)) {
    const b = fs.readFileSync(p);
    if (!base.equals(b)) return { pass: false, diff: unifiedDiff(paths[0], p) };
  }
  return { pass: true };
}

const SHARE_COPIES = [
  ['analysisValidator.js', 'features/analysis-studio/lib/'], ['analysisStruct.js', 'features/analysis-studio/lib/'], ['webCitations.js', 'features/analysis-studio/lib/'],
  ['analysisContext.js', 'features/analysis-studio/lib/'], ['analysisPrompt.js', 'features/analysis-studio/lib/'],
  ['driftNote.js', 'shared/lib/'], ['dropRedatedRepeats.js', 'shared/lib/'],
];
const FE_DATA = 'global-perspectives-starter/frontend/src/shared/data';
const FE_LIB = 'global-perspectives-starter/frontend/src/shared/lib';
const FE_FEATURES = 'global-perspectives-starter/frontend/src/features';

/** The text between `// --- <marker> ---` and `// --- end <marker> ---` (null when a marker is missing). */
function markedBlock(src, marker) {
  const a = src.indexOf(`// --- ${marker}`);
  const b = src.indexOf(`// --- end ${marker} ---`);
  return a >= 0 && b > a ? src.slice(src.indexOf('\n', a) + 1, b) : null;
}

/** The marked core of two files (one CommonJS, one ES module) must be the same text. */
function checkMarkedCore(pathA, pathB, marker) {
  const a = markedBlock(fs.readFileSync(pathA, 'utf8'), marker);
  const b = markedBlock(fs.readFileSync(pathB, 'utf8'), marker);
  if (a === null || b === null) return { pass: false, diff: `"${marker}" markers missing in ${a === null ? pathA : pathB}` };
  if (a === b) return { pass: true };
  return { pass: false, diff: textDiff(path.basename(pathA), a, `frontend-${path.basename(pathB)}`, b) };
}

/** Country identity: the country table is byte-identical to the frontend data copy, and the resolver
 *  core in backend/shared/src/countries.js is the same text as in the frontend shared/lib/countries.js. */
function checkCountryIdentity(backendPath = abs(`${SHARED}/countries.js`), frontendPath = abs(`${FE_LIB}/countries.js`)) {
  const r = checkAllIdentical([abs(`${SHARED}/iso3Names.json`), abs(`${FE_DATA}/iso3Names.json`)]);
  if (!r.pass) return { pass: false, diff: `iso3Names.json: ${r.diff}` };
  return checkMarkedCore(backendPath, frontendPath, 'country resolver core');
}

function checkCountryFacts(pathA, pathB) {
  const a = JSON.parse(fs.readFileSync(pathA, 'utf8'));
  const b = JSON.parse(fs.readFileSync(pathB, 'utf8'));
  const diffs = jsonStructuralDiff(a, b);
  if (!diffs.length) return { pass: true };
  return { pass: false, diff: diffs.join('\n') };
}

function checkEntityNormalization(classifierCorePath, entityNormalizePath) {
  // classifier-core.js is documented "NO AWS, NO network" — safe to require().
  // Clear any stale cache from a previous --self-test iteration (temp paths
  // are unique per run via mkdtemp, but be defensive regardless).
  delete req.cache[req.resolve(classifierCorePath)];
  delete req.cache[req.resolve(entityNormalizePath)];
  const classifierCore = req(classifierCorePath);
  const entityNormalize = req(entityNormalizePath);

  const problems = [];

  // (1) normalizeEntity — exported by both; direct source comparison.
  const fnA = classifierCore.normalizeEntity && classifierCore.normalizeEntity.toString();
  const fnB = entityNormalize.normalizeEntity && entityNormalize.normalizeEntity.toString();
  if (!fnA || !fnB) {
    problems.push('normalizeEntity not exported by one or both modules');
  } else if (fnA !== fnB) {
    problems.push(`normalizeEntity.toString() differs:\n${textDiff('classifier-core', fnA, 'entity-normalize', fnB)}`);
  }

  // (2)-(4) ACTOR_ALIASES / ENTITY_TITLE_PREFIX / ENTITY_ORG_SUFFIX are NOT
  // exported by either module (verified by reading both files' module.exports)
  // — fall back to marker-based text extraction from source, per plan §1.1(d)
  // fallback clause.
  const srcA = fs.readFileSync(classifierCorePath, 'utf8');
  const srcB = fs.readFileSync(entityNormalizePath, 'utf8');

  const aliasA = extractUnexported(srcA, 'ACTOR_ALIASES');
  const aliasB = extractUnexported(srcB, 'ACTOR_ALIASES');
  if (!aliasA.found || !aliasB.found) {
    problems.push('ACTOR_ALIASES not found via marker extraction in one or both files');
  } else {
    const jA = JSON.stringify(aliasA.value);
    const jB = JSON.stringify(aliasB.value);
    if (jA !== jB) problems.push(`ACTOR_ALIASES differs:\n${textDiff('classifier-core', jA, 'entity-normalize', jB)}`);
  }

  for (const name of ['ENTITY_TITLE_PREFIX', 'ENTITY_ORG_SUFFIX']) {
    const exA = extractUnexported(srcA, name);
    const exB = extractUnexported(srcB, name);
    if (!exA.found || !exB.found) {
      problems.push(`${name} not found via marker extraction in one or both files`);
      continue;
    }
    if (exA.value.source !== exB.value.source) {
      problems.push(`${name}.source differs: A=${exA.value.source} B=${exB.value.source}`);
    }
  }

  if (!problems.length) return { pass: true };
  return { pass: false, diff: problems.join('\n\n') };
}

// ---------------------------------------------------------------------------
// pair registry
// ---------------------------------------------------------------------------

function livePairs() {
  return [
    {
      name: 'country_facts.json',
      run: () => checkCountryFacts(
        fnPath('newsCountryIntelligence', 'src/country_facts.json'),
        fnPath('newsPairIntelligence', 'src/country_facts.json'),
      ),
    },
    { name: 'country identity (name tables + resolver core, backend vs frontend)', run: () => checkCountryIdentity() },
    {
      name: 'link rules (backend/shared/src/links.js vs frontend shared/lib/links.js)',
      run: () => checkMarkedCore(abs(`${SHARED}/links.js`), abs(`${FE_LIB}/links.js`), 'link rules core'),
    },
    {
      name: 'board rules (backend/shared/src/record.js vs frontend shared/lib/board.js)',
      run: () => checkMarkedCore(abs(`${SHARED}/record.js`), abs(`${FE_LIB}/board.js`), 'board rules core'),
    },
    {
      name: 'weekly sections (backend/weekly/sections.js vs frontend features/weekly/lib/sections.js)',
      run: () => checkMarkedCore(abs('backend/weekly/sections.js'), abs(`${FE_FEATURES}/weekly/lib/sections.js`), 'weekly sections core'),
    },
    {
      // Batch 4 / G: the Studio share Lambda re-derives sources and re-runs the checks with the frontend's own
      // pure modules, so its copies must stay byte-identical (and so must the golden context fixture both test against).
      name: 'Studio share modules (frontend + newsSharedAnalysis, 7 files + golden fixture)',
      run: () => {
        for (const [f, dir] of SHARE_COPIES) {
          const r = checkAllIdentical([abs(`global-perspectives-starter/frontend/src/${dir}${f}`), fnPath('newsSharedAnalysis', `src/${f}`)]);
          if (!r.pass) return r;
        }
        return checkAllIdentical([
          abs('global-perspectives-starter/frontend/src/features/analysis-studio/__tests__/fixtures/contextGolden.json'),
          fnPath('newsSharedAnalysis', 'test/fixtures/contextGolden.json'),
        ]);
      },
    },
    {
      // Batch 4 / D: the weekly draw rule exists twice (settle Lambda: Node crypto; frontend "Verify this draw":
      // WebCrypto). Both sides test against this one golden fixture, so the two must stay byte-identical.
      name: 'sampleRuleGolden.json (settle Lambda + frontend)',
      run: () => checkAllIdentical([
        fnPath('newsPredictionResolver', 'test/fixtures/sampleRuleGolden.json'),
        abs('global-perspectives-starter/frontend/src/features/track-record/__tests__/fixtures/sampleRuleGolden.json'),
      ]),
    },
    {
      name: 'entity-normalization',
      run: async () => checkEntityNormalization(
        fnPath('newsSituationIngest', 'src/classifier-core.js'),
        fnPath('NewsProjectInvokeAgentLambda', 'src/entity-normalize.js'),
      ),
    },
  ];
}

async function runPair(pair) {
  const result = await pair.run();
  if (result.pass) {
    console.log(`PASS  ${pair.name}`);
    return true;
  }
  console.log(`DRIFT ${pair.name}`);
  console.log(result.diff.split('\n').map((l) => `      ${l}`).join('\n'));
  return false;
}

async function main() {
  console.log('Shared-module drift guard — ONE_TRUTH_EXECUTION_PLAN.md Phase 1\n');
  let allPass = true;
  for (const pair of livePairs()) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await runPair(pair);
    allPass = allPass && ok;
  }
  console.log('');
  console.log(allPass ? 'ALL PASS' : 'DRIFT DETECTED — see above');
  process.exit(allPass ? 0 : 1);
}

// ---------------------------------------------------------------------------
// --self-test — proves the guard can actually fail. Copies each pair's two
// files into a fresh os.tmpdir() dir, perturbs ONE character in one copy (a
// syntactically-safe location, so JSON.parse/require() still succeed), points
// the same check function at the perturbed temp paths, and asserts DRIFT is
// reported. Never touches the real repo files.
// ---------------------------------------------------------------------------

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'check-shared-sync-selftest-'));
}

async function selfTestCountryFacts() {
  const dir = mkTmp();
  const srcA = fnPath('newsCountryIntelligence', 'src/country_facts.json');
  const a = path.join(dir, 'a.json');
  const b = path.join(dir, 'b.json');
  fs.copyFileSync(srcA, a);
  const raw = fs.readFileSync(srcA, 'utf8');
  const parsed = JSON.parse(raw);
  // Perturb one character in a real (non-_meta) data value, keeping valid JSON.
  const firstCountryKey = Object.keys(parsed).find((k) => k !== '_meta');
  const country = parsed[firstCountryKey];
  const factKey = Object.keys(country).find((k) => typeof country[k] === 'string');
  if (factKey) country[factKey] = `${country[factKey]}x`;
  fs.writeFileSync(b, JSON.stringify(parsed, null, 2));
  const result = checkCountryFacts(a, b);
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

async function selfTestCountryIdentity() {
  const dir = mkTmp();
  const b = path.join(dir, 'countries.js');
  const ref = fs.readFileSync(abs(`${FE_LIB}/countries.js`), 'utf8');
  fs.writeFileSync(b, ref.replace("COUNTRIES[t]) return found(t);", "COUNTRIES[t]) return found(t) || null;"));
  const result = checkCountryIdentity(abs(`${SHARED}/countries.js`), b);
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

async function selfTestLinkRules() {
  const dir = mkTmp();
  const b = path.join(dir, 'links.js');
  const ref = fs.readFileSync(abs(`${FE_LIB}/links.js`), 'utf8');
  fs.writeFileSync(b, ref.replace("today: '/today'", "today: '/todayx'"));
  const result = checkMarkedCore(abs(`${SHARED}/links.js`), b, 'link rules core');
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

async function selfTestBoardRules() {
  const dir = mkTmp();
  const b = path.join(dir, 'board.js');
  const ref = fs.readFileSync(abs(`${FE_LIB}/board.js`), 'utf8');
  const perturbed = ref.replace('PIN_BUDGET = 12', 'PIN_BUDGET = 13');
  if (perturbed === ref) throw new Error('self-test fixture assumption broke: PIN_BUDGET = 12 not found');
  fs.writeFileSync(b, perturbed);
  const result = checkMarkedCore(abs(`${SHARED}/record.js`), b, 'board rules core');
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

async function selfTestWeeklySections() {
  const dir = mkTmp();
  const b = path.join(dir, 'sections.js');
  const ref = fs.readFileSync(abs(`${FE_FEATURES}/weekly/lib/sections.js`), 'utf8');
  const perturbed = ref.replace('max: 6', 'max: 7');
  if (perturbed === ref) throw new Error('self-test fixture assumption broke: max: 6 not found');
  fs.writeFileSync(b, perturbed);
  const result = checkMarkedCore(abs('backend/weekly/sections.js'), b, 'weekly sections core');
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

async function selfTestEntityNormalization() {
  const dir = mkTmp();
  const srcA = fnPath('newsSituationIngest', 'src/classifier-core.js');
  const srcB = fnPath('NewsProjectInvokeAgentLambda', 'src/entity-normalize.js');
  const a = path.join(dir, 'classifier-core.js');
  const b = path.join(dir, 'entity-normalize.js');
  fs.copyFileSync(srcA, a);
  let raw = fs.readFileSync(srcB, 'utf8');
  // Perturb one character inside an ACTOR_ALIASES value (still valid JS/JSON literal).
  const perturbed = raw.replace("'trump'", "'trumpx'");
  if (perturbed === raw) throw new Error("self-test fixture assumption broke: 'trump' alias not found");
  fs.writeFileSync(b, perturbed);
  const result = await checkEntityNormalization(a, b);
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

async function selfTestSampleGolden() {
  const dir = mkTmp();
  const a = path.join(dir, 'a.json'); const b = path.join(dir, 'b.json');
  const ref = fs.readFileSync(fnPath('newsPredictionResolver', 'test/fixtures/sampleRuleGolden.json'), 'utf8');
  fs.writeFileSync(a, ref); fs.writeFileSync(b, ref.replace('"K": 22', '"K": 23'));
  const result = checkAllIdentical([a, b]);
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

async function selfTestShareModules() {
  const dir = mkTmp();
  const a = path.join(dir, 'a.js'); const b = path.join(dir, 'b.js');
  const ref = fs.readFileSync(abs('global-perspectives-starter/frontend/src/features/analysis-studio/lib/analysisValidator.js'), 'utf8');
  fs.writeFileSync(a, ref); fs.writeFileSync(b, ref.replace("'phantom_citation'", "'phantom_citationx'"));
  const result = checkAllIdentical([a, b]);
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

async function selfTest() {
  console.log('Self-test — perturbing one byte per pair and confirming DRIFT is caught\n');
  const cases = [
    ['country_facts.json', selfTestCountryFacts],
    ['country identity', selfTestCountryIdentity],
    ['link rules', selfTestLinkRules],
    ['board rules', selfTestBoardRules],
    ['weekly sections', selfTestWeeklySections],
    ['entity-normalization', selfTestEntityNormalization],
    ['sampleRuleGolden.json', selfTestSampleGolden],
    ['Studio share modules', selfTestShareModules],
  ];
  let allCaught = true;
  for (const [name, fn] of cases) {
    // eslint-disable-next-line no-await-in-loop
    const result = await fn();
    if (result.pass) {
      console.log(`SELF-TEST FAIL ${name} — perturbation was NOT detected (guard is not working)`);
      allCaught = false;
    } else {
      console.log(`SELF-TEST OK   ${name} — perturbation correctly reported as DRIFT`);
    }
  }
  console.log('');
  console.log(allCaught ? 'SELF-TEST PASS — guard demonstrably catches drift' : 'SELF-TEST FAILED — guard did not catch a known perturbation');
  process.exit(allCaught ? 0 : 1);
}

// ---------------------------------------------------------------------------

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  main();
}
