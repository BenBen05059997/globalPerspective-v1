'use strict';

// Capture-gate + structured-trigger tests for prediction methodology v1 — run with `node --test`.
// The gates are the mechanical guarantee that no malformed trigger reaches the immutable
// prediction log. Cases use the REAL defective triggers found by the 2026-07-04 resolution
// pilot (their own generation dates), so a regression re-opens a defect we already diagnosed.
// See PREDICTION_METHODOLOGY_V1_PLAN.md §3 and PREDICTION_V1_EXAMPLE.md.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseTriggerDeadline,
  normalizeTrigger,
  validateTrigger,
  buildGatedScenarios,
  addDays,
  METHODOLOGY_VERSION,
} = require('../src/lib');

// ---------- G2: retrodictions (deadline before/at generation) — the 16%-of-pilot killer ----------

test('G2 rejects the New START retrodiction (pilot #2: Feb deadline, June generation)', () => {
  const r = validateTrigger(
    { text: 'New START Treaty expiration on February 5, 2026 without successor agreement', deadline: '2026-02-05' },
    '2026-06-08',
  );
  assert.equal(r.ok, false);
  assert.equal(r.gate, 'G2');
});

test('G2 rejects a historical-year deadline artifact (pilot #0: 2021)', () => {
  const r = validateTrigger(
    { text: 'Cuba releases July 2021 protest leaders before December 2026', deadline: '2021-07-31' },
    '2026-06-05',
  );
  assert.equal(r.ok, false);
  assert.equal(r.gate, 'G2');
});

test('G2 rejects a same-day deadline (pilot #29: window recorded as its anchor date)', () => {
  const r = validateTrigger(
    { text: 'Africa CDC deploys all 10 mobile laboratories within 30 days of June 5, 2026', deadline: '2026-06-05' },
    '2026-06-05',
  );
  assert.equal(r.ok, false);
  assert.equal(r.gate, 'G2'); // deadline <= generation
});

// ---------- G1: no/invalid date ----------

test('G1 rejects a trigger with no extractable deadline', () => {
  const r = validateTrigger(normalizeTrigger('Tensions escalate significantly', 2026), '2026-07-04');
  assert.equal(r.ok, false);
  assert.equal(r.gate, 'G1');
});

test('G1 rejects a malformed deadline string', () => {
  const r = validateTrigger({ text: 'x', deadline: '2026-13-40' }, '2026-07-04');
  assert.equal(r.ok, false);
  assert.equal(r.gate, 'G1');
});

// ---------- G3: horizon ----------

test('G3 rejects a deadline beyond the 180-day horizon', () => {
  const r = validateTrigger({ text: 'far-future junk', deadline: '2027-06-01' }, '2026-07-04');
  assert.equal(r.ok, false);
  assert.equal(r.gate, 'G3');
});

// ---------- G4: falsifiability lint ----------

test('G4 rejects a relative-window trigger even if the deadline is otherwise valid', () => {
  const r = validateTrigger(
    { text: 'Ceasefire holds within 30 days of the announcement', deadline: '2026-08-01' },
    '2026-07-04',
  );
  assert.equal(r.ok, false);
  assert.equal(r.gate, 'G4');
});

test('G4 rejects a precedent reference (pilot #1)', () => {
  // Give it a forward, valid deadline so ONLY G4 can be the reason it fails.
  const r = validateTrigger(
    { text: 'Protesters disperse within 3 days as seen in July 2023 precedent', deadline: '2026-08-01' },
    '2026-07-04',
  );
  assert.equal(r.ok, false);
  assert.equal(r.gate, 'G4');
});

// ---------- G6: capture-scope — pure sporting results dropped, sport-adjacent governance kept ----------
// Uses the REAL triggers from the 2026-07-07 first resolution run (Trump–FIFA / Balogun story).

test('G6 drops a box-score participation trigger (Balogun starts vs Belgium)', () => {
  const r = validateTrigger(
    { text: 'Folarin Balogun starts or appears as a substitute in the U.S. vs. Belgium round of 16 match', deadline: '2026-07-07' },
    '2026-07-06',
  );
  assert.equal(r.ok, false);
  assert.equal(r.gate, 'G6');
});

test('G6 drops a match-outcome trigger (U.S. wins its round of 16 match)', () => {
  const r = validateTrigger(
    { text: 'U.S. wins its round of 16 match against Belgium on July 7', deadline: '2026-07-07' },
    '2026-07-06',
  );
  assert.equal(r.ok, false);
  assert.equal(r.gate, 'G6');
});

test('G6 KEEPS the institutional sport-adjacent trigger (Belgium files a FIFA protest)', () => {
  const r = validateTrigger(
    { text: "Belgium files an official protest with FIFA's Disciplinary Committee regarding the ban reversal", deadline: '2026-07-07' },
    '2026-07-06',
  );
  assert.equal(r.ok, true); // FIFA governance action, no result verb — this is in-remit
});

test('G6 KEEPS a legal-action trigger even when it mentions "match" (CAS interim measure)', () => {
  const r = validateTrigger(
    { text: "CAS grants an emergency interim measure suspending Balogun's clearance before the match", deadline: '2026-07-07' },
    '2026-07-06',
  );
  assert.equal(r.ok, true); // "match" is context but there is no result/participation verb
});

test('G6 does NOT catch political "wins/advances/starts" (no sporting context)', () => {
  const gen = '2026-07-04';
  const political = [
    { text: 'The incumbent party wins an outright majority in the July 20 parliamentary election', deadline: '2026-07-20' },
    { text: 'The challenger advances to the second round of the presidential election', deadline: '2026-07-25' },
    { text: 'The government starts formal accession talks with the bloc', deadline: '2026-08-30' },
    { text: 'Brent crude scores its largest weekly gain amid the supply shock', deadline: '2026-07-18' },
  ];
  for (const t of political) assert.equal(validateTrigger(t, gen).ok, true, t.text);
});

// ---------- G5: premise check against verified FACTS# ----------

test('G5 rejects a trigger naming a stale office-holder (pilot #15: Nyusi vs verified Chapo)', () => {
  const facts = [{ country: 'Mozambique', current: ['Daniel Chapo'], stale: ['Nyusi'] }];
  const r = validateTrigger(
    { text: 'Ramaphosa and Nyusi hold emergency bilateral summit via video conference', deadline: '2026-07-20' },
    '2026-07-04',
    facts,
  );
  assert.equal(r.ok, false);
  assert.equal(r.gate, 'G5');
});

test('G5 skips (does not fail) when there is no FACTS coverage for the region', () => {
  const r = validateTrigger(
    { text: 'Ramaphosa and Nyusi hold a summit', deadline: '2026-07-20' },
    '2026-07-04',
    [], // no coverage
  );
  assert.equal(r.ok, true);
});

// ---------- Happy path: exemplar v1 triggers all pass ----------

test('exemplar v1 triggers (forward, absolute, in-horizon) all pass', () => {
  const gen = '2026-07-04';
  const good = [
    { text: 'Ukraine strikes another Russian oil refinery, reported by a major outlet, by 2026-07-18', deadline: '2026-07-18' },
    { text: 'Russia launches another mass attack on Kyiv with 20+ deaths by 2026-07-18', deadline: '2026-07-18' },
    { text: 'Direct or mediated Russia-Ukraine talks are formally announced by 2026-08-15', deadline: '2026-08-15' },
  ];
  for (const t of good) assert.equal(validateTrigger(t, gen).ok, true, t.text);
});

// ---------- deadline parsing (legacy free-text fallback) ----------

test('parseTriggerDeadline handles ISO, Month D YYYY, and bare Month YYYY (→ month end)', () => {
  assert.equal(parseTriggerDeadline('by 2026-08-15', 2026), '2026-08-15');
  assert.equal(parseTriggerDeadline('on August 15, 2026', 2026), '2026-08-15');
  assert.equal(parseTriggerDeadline('by August 2026', 2026), '2026-08-31');
  assert.equal(parseTriggerDeadline('no date here', 2026), null);
});

test('normalizeTrigger prefers a structured ISO deadline over parsing the prose', () => {
  const n = normalizeTrigger({ text: 'happens by August 2026', deadline: '2026-08-10' }, 2026);
  assert.equal(n.deadline, '2026-08-10'); // structured wins over the "August 2026 → month-end" parse
});

test('addDays crosses month boundaries in UTC', () => {
  assert.equal(addDays('2026-07-04', 180), '2026-12-31');
});

// ---------- buildGatedScenarios: end-to-end assembly + capture report ----------

test('buildGatedScenarios keeps good triggers, drops defects, and reports both', () => {
  const raw = [
    {
      label: 'Most Likely',
      probability_range: '55-65%',
      horizon: '2-4 weeks',
      rationale: 'grounded in the arc',
      triggers: [
        { text: 'Ukraine strikes another refinery by 2026-07-18', deadline: '2026-07-18' }, // keep
        { text: 'New START expired February 5, 2026', deadline: '2026-02-05' },              // drop G2
      ],
    },
    {
      label: 'Pessimistic',
      probability_range: '20-25%',
      horizon: '4-8 weeks',
      triggers: [
        { text: 'Escalation continues within 30 days of today', deadline: '2026-08-01' },    // drop G4
      ],
    },
  ];
  const out = buildGatedScenarios(raw, { generatedAtDay: '2026-07-04', fallbackYear: 2026 });

  assert.equal(out.capture.methodologyVersion, METHODOLOGY_VERSION);
  assert.equal(out.capture.kept, 1);
  assert.equal(out.capture.dropped.length, 2);
  assert.deepEqual(out.capture.dropped.map(d => d.gate).sort(), ['G2', 'G4']);

  // scenario 0 kept its one good trigger and is scoreable; scenario 1 lost its only trigger.
  assert.equal(out.scenarios[0].triggers.length, 1);
  assert.equal(out.scenarios[0].triggers[0].deadline, '2026-07-18');
  assert.equal(out.scenarios[0].scoreable, true);
  assert.equal(out.scenarios[1].triggers.length, 0);
  assert.equal(out.scenarios[1].scoreable, false);

  // probability midpoints computed
  assert.equal(out.scenarios[0].probability, 0.6);
});

test('buildGatedScenarios tolerates missing/empty scenarios without throwing', () => {
  assert.deepEqual(buildGatedScenarios(undefined, { generatedAtDay: '2026-07-04', fallbackYear: 2026 }).scenarios, []);
  assert.equal(buildGatedScenarios([], { generatedAtDay: '2026-07-04', fallbackYear: 2026 }).capture.kept, 0);
});
