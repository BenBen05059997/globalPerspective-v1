#!/usr/bin/env node
/**
 * Shared-module drift guard (ONE_TRUTH_EXECUTION_PLAN.md Phase 1).
 *
 * This repo has no Lambda layers — each function is a separate manual-deploy
 * unit, so a handful of modules exist as hand-synced COPIES across two or more
 * function dirs. When one copy is edited and its sibling isn't, the two Lambdas
 * silently diverge (e.g. one classifies a risk axis differently from the other)
 * with no build step or import graph to catch it. This script is the catch.
 *
 * Guards exactly 5 known pairs:
 *   (a) riskDimensions.js               — byte-identical, zero tolerance
 *   (b) situations-core.js              — byte-identical after stripping the
 *                                          Tracker copy's known 2-line header
 *   (c) country_facts.json              — structural JSON compare, excluding
 *                                          only _meta.description / _meta.sync
 *   (d) entity-normalization block      — require() both + compare exports
 *                                          (normalizeEntity source; ACTOR_ALIASES
 *                                          and the two regexes are NOT exported
 *                                          by either side, so those three are
 *                                          compared via marker-based text
 *                                          extraction from source instead — see
 *                                          extractUnexported() below)
 *
 *   (e) iso3Names.json                  — newsCountryIntelligence's ISO3->name table must equal the
 *                                          frontend's ISO3_NAME (features/map/lib/situationLabels.js),
 *                                          extracted from source with extractUnexported()
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

const HEADER_2LINE =
  '// ⚠️ SHARED MODULE — keep byte-identical with newsGdacsIngest/src/situations-core.js.\n' +
  '// (Manual-deploy repo has no Lambda layers; sync by hand. Canonical: DATA_STRATEGY.md.)\n';

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
// the 5 pair checks — each takes explicit paths so --self-test can point them
// at perturbed temp copies instead of the live repo files.
// ---------------------------------------------------------------------------

function checkRiskDimensions(pathA, pathB) {
  const a = fs.readFileSync(pathA);
  const b = fs.readFileSync(pathB);
  if (a.equals(b)) return { pass: true };
  return { pass: false, diff: unifiedDiff(pathA, pathB) };
}

const DAYZERO_LAMBDAS = ['newsThreadAnalysis', 'newsSystemsAnalysis', 'newsCountryIntelligence', 'newsWeeklyBrief', 'newsDriftCorrector', 'newsPostDevTo'];

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
const PLACE_LAMBDAS = ['newsSystemsAnalysis', 'newsPostDevTo', 'newsBreakingAlert', 'newsWeeklyBrief', 'newsSignals', 'newsSensitiveData'];
const FE_DATA = 'global-perspectives-starter/frontend/src/shared/data';
const placeCore = (src) => { const a = src.indexOf("// Names in briefings come from the LLM's `regions`"); const b = src.indexOf('\nconst ymd = '); const e = src.indexOf('\n/** isRealCountryName'); const t = src.indexOf('\n// A COUNTRY# record a reader may use'); return src.slice(a, b > 0 ? b : (t > 0 ? t : e)).trim(); };

/** Batch 3 / F: the real-country rule. (1) every Lambda copy of placeFilter.js, placeNames.json and
 *  iso3Names.json is byte-identical to newsCountryIntelligence's tables; (2) the frontend data copies too;
 *  (3) the rule text (alias table, normKey, isCountryName) in placeFilter.js and in the frontend
 *  shared/lib/placeNames.js is the same text as in newsCountryIntelligence/src/refreshPolicy.js. */
function checkPlaceRule() {
  const base = 'amplify/backend/function/newsCountryIntelligence/src';
  for (const f of ['placeNames.json', 'iso3Names.json']) {
    const r = checkAllIdentical([abs(`${base}/${f}`), ...PLACE_LAMBDAS.map((n) => abs(`amplify/backend/function/${n}/src/${f}`)), abs(`${FE_DATA}/${f}`)]);
    if (!r.pass) return { pass: false, diff: `${f}: ${r.diff}` };
  }
  const pf = checkAllIdentical(PLACE_LAMBDAS.map((n) => abs(`amplify/backend/function/${n}/src/placeFilter.js`)));
  if (!pf.pass) return { pass: false, diff: `placeFilter.js: ${pf.diff}` };
  const ref = placeCore(fs.readFileSync(abs(`${base}/refreshPolicy.js`), 'utf8'));
  for (const f of [`amplify/backend/function/${PLACE_LAMBDAS[0]}/src/placeFilter.js`, 'global-perspectives-starter/frontend/src/shared/lib/placeNames.js']) {
    const got = placeCore(fs.readFileSync(abs(f), 'utf8'));
    if (got !== ref) return { pass: false, diff: `${f}: the real-country rule text differs from refreshPolicy.js\n${textDiff('refreshPolicy.js', ref, path.basename(f), got)}` };
  }
  return { pass: true };
}

function checkSituationsCore(trackerPath, ingestPath) {
  const trackerRaw = fs.readFileSync(trackerPath, 'utf8');
  const ingestRaw = fs.readFileSync(ingestPath, 'utf8');
  const trackerStripped = trackerRaw.startsWith(HEADER_2LINE)
    ? trackerRaw.slice(HEADER_2LINE.length)
    : trackerRaw;
  if (trackerStripped === ingestRaw) return { pass: true };
  return {
    pass: false,
    diff: textDiff('tracker(header-stripped)', trackerStripped, 'gdacs', ingestRaw),
  };
}

function checkCountryFacts(pathA, pathB) {
  const a = JSON.parse(fs.readFileSync(pathA, 'utf8'));
  const b = JSON.parse(fs.readFileSync(pathB, 'utf8'));
  const diffs = jsonStructuralDiff(a, b);
  if (!diffs.length) return { pass: true };
  return { pass: false, diff: diffs.join('\n') };
}

function checkIso3Names(jsonPath, frontendPath) {
  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const ex = extractUnexported(fs.readFileSync(frontendPath, 'utf8'), 'ISO3_NAME');
  if (!ex.found) return { pass: false, diff: 'ISO3_NAME not found in the frontend source (marker changed?)' };
  const diffs = jsonStructuralDiff(json, ex.value);
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
      name: 'riskDimensions.js',
      run: () => checkRiskDimensions(
        abs('amplify/backend/function/newsCountryIntelligence/src/riskDimensions.js'),
        abs('amplify/backend/function/newsThreadAnalysis/src/riskDimensions.js'),
      ),
    },
    {
      name: 'situations-core.js',
      run: () => checkSituationsCore(
        abs('amplify/backend/function/newsSituationTracker/src/situations-core.js'),
        abs('amplify/backend/function/newsGdacsIngest/src/situations-core.js'),
      ),
    },
    {
      name: 'country_facts.json',
      run: () => checkCountryFacts(
        abs('amplify/backend/function/newsCountryIntelligence/src/country_facts.json'),
        abs('amplify/backend/function/newsPairIntelligence/src/country_facts.json'),
      ),
    },
    {
      name: 'iso3Names.json',
      run: () => checkIso3Names(
        abs('amplify/backend/function/newsCountryIntelligence/src/iso3Names.json'),
        abs('global-perspectives-starter/frontend/src/features/map/lib/situationLabels.js'),
      ),
    },
    {
      // Batch 3 / A: the day-zero rule for today-archive readers — six byte-identical copies.
      name: 'dayZero.js (x6)',
      run: () => checkAllIdentical(DAYZERO_LAMBDAS.map((n) => abs(`amplify/backend/function/${n}/src/dayZero.js`))),
    },
    { name: 'real-country rule (placeFilter x6, name tables x8, frontend)', run: () => checkPlaceRule() },
    {
      // Batch 4 / G: the Studio share Lambda re-derives sources and re-runs the checks with the frontend's own
      // pure modules, so its copies must stay byte-identical (and so must the golden context fixture both test against).
      name: 'Studio share modules (frontend + newsSharedAnalysis, 7 files + golden fixture)',
      run: () => {
        for (const [f, dir] of SHARE_COPIES) {
          const r = checkAllIdentical([abs(`global-perspectives-starter/frontend/src/${dir}${f}`), abs(`amplify/backend/function/newsSharedAnalysis/src/${f}`)]);
          if (!r.pass) return r;
        }
        return checkAllIdentical([
          abs('global-perspectives-starter/frontend/src/features/analysis-studio/__tests__/fixtures/contextGolden.json'),
          abs('amplify/backend/function/newsSharedAnalysis/test/fixtures/contextGolden.json'),
        ]);
      },
    },
    {
      // Batch 4 / D: the weekly draw rule exists twice (settle Lambda: Node crypto; frontend "Verify this draw":
      // WebCrypto). Both sides test against this one golden fixture, so the two must stay byte-identical.
      name: 'sampleRuleGolden.json (settle Lambda + frontend)',
      run: () => checkAllIdentical([
        abs('amplify/backend/function/newsPredictionResolver/test/fixtures/sampleRuleGolden.json'),
        abs('global-perspectives-starter/frontend/src/features/track-record/__tests__/fixtures/sampleRuleGolden.json'),
      ]),
    },
    {
      name: 'entity-normalization',
      run: async () => checkEntityNormalization(
        abs('amplify/backend/function/newsSituationIngest/src/classifier-core.js'),
        abs('amplify/backend/function/NewsProjectInvokeAgentLambda/src/entity-normalize.js'),
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

async function selfTestRiskDimensions() {
  const dir = mkTmp();
  const srcA = abs('amplify/backend/function/newsCountryIntelligence/src/riskDimensions.js');
  const a = path.join(dir, 'riskDimensions.a.js');
  const b = path.join(dir, 'riskDimensions.b.js');
  fs.copyFileSync(srcA, a);
  fs.copyFileSync(srcA, b);
  // Perturb one byte in a trailing comment/whitespace-safe spot: append one char.
  fs.appendFileSync(b, '\n// x');
  const result = checkRiskDimensions(a, b);
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

async function selfTestSituationsCore() {
  const dir = mkTmp();
  const trackerSrc = abs('amplify/backend/function/newsSituationTracker/src/situations-core.js');
  const ingestSrc = abs('amplify/backend/function/newsGdacsIngest/src/situations-core.js');
  const t = path.join(dir, 'tracker.js');
  const g = path.join(dir, 'gdacs.js');
  fs.copyFileSync(trackerSrc, t);
  fs.copyFileSync(ingestSrc, g);
  fs.appendFileSync(g, '\n// x');
  const result = checkSituationsCore(t, g);
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

async function selfTestCountryFacts() {
  const dir = mkTmp();
  const srcA = abs('amplify/backend/function/newsCountryIntelligence/src/country_facts.json');
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

async function selfTestIso3Names() {
  const dir = mkTmp();
  const b = path.join(dir, 'iso3Names.json');
  const parsed = JSON.parse(fs.readFileSync(abs('amplify/backend/function/newsCountryIntelligence/src/iso3Names.json'), 'utf8'));
  parsed.USA = `${parsed.USA}x`;
  fs.writeFileSync(b, JSON.stringify(parsed));
  const result = checkIso3Names(b, abs('global-perspectives-starter/frontend/src/features/map/lib/situationLabels.js'));
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

async function selfTestEntityNormalization() {
  const dir = mkTmp();
  const srcA = abs('amplify/backend/function/newsSituationIngest/src/classifier-core.js');
  const srcB = abs('amplify/backend/function/NewsProjectInvokeAgentLambda/src/entity-normalize.js');
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

async function selfTestDayZero() {
  const dir = mkTmp();
  const paths = DAYZERO_LAMBDAS.map((n, i) => {
    const t = path.join(dir, `dayZero${i}.js`);
    fs.copyFileSync(abs(`amplify/backend/function/${n}/src/dayZero.js`), t);
    return t;
  });
  fs.writeFileSync(paths[3], fs.readFileSync(paths[3], 'utf8').replace('utcDay(t) === today', 'utcDay(t) !== today'));
  const result = checkAllIdentical(paths);
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

async function selfTestPlaceRule() {
  const dir = mkTmp();
  const ref = fs.readFileSync(abs('amplify/backend/function/newsSystemsAnalysis/src/placeFilter.js'), 'utf8');
  const a = path.join(dir, 'a.js'); const b = path.join(dir, 'b.js');
  fs.writeFileSync(a, ref); fs.writeFileSync(b, ref.replace("'uk': 'united kingdom'", "'uk': 'united kingdomx'"));
  const result = checkAllIdentical([a, b]);
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

async function selfTestSampleGolden() {
  const dir = mkTmp();
  const a = path.join(dir, 'a.json'); const b = path.join(dir, 'b.json');
  const ref = fs.readFileSync(abs('amplify/backend/function/newsPredictionResolver/test/fixtures/sampleRuleGolden.json'), 'utf8');
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
    ['riskDimensions.js', selfTestRiskDimensions],
    ['situations-core.js', selfTestSituationsCore],
    ['country_facts.json', selfTestCountryFacts],
    ['iso3Names.json', selfTestIso3Names],
    ['entity-normalization', selfTestEntityNormalization],
    ['dayZero.js (x6)', selfTestDayZero],
    ['real-country rule', selfTestPlaceRule],
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
