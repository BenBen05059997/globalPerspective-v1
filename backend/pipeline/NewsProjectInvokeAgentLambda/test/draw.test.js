'use strict';

// Forecast DRAW stage (decision 0038): cadence, outcome count, outcome gates, output shape.

const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../src/lib');
const draw = require('../src/forecast-draw');

const TODAY = '2026-10-22';
const topic = { id: 't-1', title: 'Port strike widens', description: 'Dockworkers extend a strike.', regions: ['Germany'], sources: [{ source: 'Reuters', snippet: 'Talks collapsed on Tuesday.' }] };
const out = (over = {}) => ({ text: 'Parliament passes the port labour bill', deadline: '2026-11-20', p: 40, resolution_source: 'Official Gazette of Germany', rationale: 'Base rate from precedents.', ...over });
const run = (outcomes, extra = {}) => {
  const parsed = draw.outcomesToScenarios({ precedents: [], outcomes, winners: ['A'], losers: ['B'] });
  return lib.buildGatedScenarios(parsed.scenarios, { generatedAtDay: TODAY, fallbackYear: 2026, pk: 'PRED#t-1', sk: TODAY, snippets: [], priorTexts: [], outcomeMode: true, ...extra });
};
const keptTexts = (r) => r.scenarios.flatMap((s) => s.triggers).map((t) => t.text);

// ---------- prompt ----------

test('the prompt asks for at most 3 outcomes, done not said, due 7-90 days, and no longer for 3 scenarios', () => {
  const p = draw.buildPredictionPrompt(topic, 'October 22, 2026', 2026, {}, TODAY);
  assert.match(p, /AT MOST 3 distinct outcomes/);
  assert.match(p, /"outcomes": \[/);
  assert.match(p, /DONE, not something SAID/);
  assert.ok(p.includes('on or after 2026-10-29'), 'lead 7 days');
  assert.ok(p.includes('on/before 2027-01-20'), 'lead 90 days');
  assert.match(p, /every outcome is due 7 to 90 days/);
  assert.match(p, /own "p"/);
  assert.match(p, /NAME the publisher or record/);
  assert.doesNotMatch(p, /Optimistic|Pessimistic|Most Likely|"scenarios"|triggers per scenario/);
});

test('PROMPT_VERSION 3 and the horizon gate is 90 days', () => {
  assert.equal(lib.PROMPT_VERSION, 3);
  assert.equal(lib.HORIZON_DAYS, 90);
  assert.equal(lib.MAX_OUTCOMES, 3);
});

// ---------- gate table ----------

test('lead time: 6 days dropped, 7 and 90 kept, 91 dropped', () => {
  const cases = [['2026-10-28', false, 'G9'], ['2026-10-29', true], ['2027-01-20', true], ['2027-01-21', false, 'G3']];
  for (const [deadline, keep, gate] of cases) {
    const r = run([out({ deadline })]);
    assert.equal(keptTexts(r).length, keep ? 1 : 0, deadline);
    if (!keep) assert.equal(r.capture.dropped[0].gate, gate, deadline);
  }
});

test('said-not-done is dropped (G14); done verbs are kept, also next to an announcement', () => {
  const said = ['Chancellor says the strike will end', 'Port authority announces new talks', 'Ministry denies responsibility for the delay', 'Union warns of a wider walkout', 'Government issues a statement on the strike'];
  for (const text of said) {
    const r = run([out({ text })]);
    assert.equal(keptTexts(r).length, 0, text);
    assert.equal(r.capture.dropped[0].gate, 'G14', text);
  }
  const done = ['Parliament passes the port labour bill', 'Government imposes a back-to-work order on dockworkers', 'Chancellor announces and signs an emergency decree', 'Union ends the strike and signs a wage deal'];
  for (const text of done) assert.equal(keptTexts(run([out({ text })])).length, 1, text);
});

test('outcome mode drops (never keeps as narrative) a missing p, a generic source and a restatement', () => {
  const r = run([out({ p: undefined }), out({ text: 'Court rules on the dock fees', resolution_source: 'news' }), out({ text: 'Dockworkers extend a strike' }), out({ text: 'EU opens an inquiry into port subsidies' })], { snippets: ['Dockworkers extend a strike.'] });
  assert.deepEqual(keptTexts(r), ['EU opens an inquiry into port subsidies']);
  assert.deepEqual(r.capture.dropped.map((d) => d.gate).sort(), ['G10', 'G7', 'G8']);
});

test('an outcome that nearly repeats an OPEN branch of the story is dropped, whatever the age of that row', () => {
  const rows = [{ SK: '2026-09-10', scenarios: [{ triggers: [{ text: 'Parliament passes the port labour bill now', deadline: '2026-11-01' }, { text: 'Old closed branch about tolls', deadline: '2026-09-30' }] }] }];
  const open = draw.openBranchTexts(rows, TODAY);
  assert.deepEqual(open, ['Parliament passes the port labour bill now']);
  const r = run([out(), out({ text: 'EU opens an inquiry into port subsidies' })], { priorTexts: open });
  assert.deepEqual(keptTexts(r), ['EU opens an inquiry into port subsidies']);
  assert.equal(r.capture.dropped[0].gate, 'G12');
});

test('cap: at most 3 outcomes are kept per draw', () => {
  const texts = ['Parliament passes the port labour bill', 'EU opens an inquiry into port subsidies', 'Union ends the strike at Hamburg', 'Government imposes a back-to-work order', 'Court suspends the dockworkers strike'];
  const r = run(texts.map((text) => out({ text })));
  assert.equal(keptTexts(r).length, 3);
  assert.deepEqual(r.capture.dropped.map((d) => d.gate), ['CAP', 'CAP']);
  assert.equal(r.scenarios.length, 3);
  assert.equal(r.capture.questions.kept, 3);
});

// ---------- cadence ----------

test('no draw when the story did not move; reuses the stored forecast', () => {
  const existing = { contentFormat: 'json' };
  const decision = lib.decideReuse({ kind: 'prediction', existing: { ...existing, sourceFingerprint: 'a' }, fingerprint: 'a', predictionLoggedToday: false });
  assert.deepEqual(draw.drawDecision({ decision, existing, lastForkDay: null, today: TODAY }), { draw: false, reuse: true, reason: 'unchanged' });
});

test('no draw within 7 days of the last fork; the 7th day draws', () => {
  const existing = { contentFormat: 'json', sourceFingerprint: 'old' };
  const decision = lib.decideReuse({ kind: 'prediction', existing, fingerprint: 'new', predictionLoggedToday: false });
  assert.equal(decision.reuse, false);
  for (const [last, drawn] of [['2026-10-21', false], ['2026-10-16', false], ['2026-10-15', true], ['2026-09-01', true], [null, true]]) {
    const d = draw.drawDecision({ decision, existing, lastForkDay: last, today: TODAY });
    assert.equal(d.draw, drawn, String(last));
    if (!drawn) assert.deepEqual([d.reuse, d.reason], [true, 'fork-within-7d']);
  }
});

test('within 7 days with nothing stored to reuse: skip (no draw, no reuse); force bypasses the cadence', () => {
  const decision = lib.decideReuse({ kind: 'prediction', existing: null, fingerprint: 'new', predictionLoggedToday: false });
  assert.deepEqual(draw.drawDecision({ decision, existing: null, lastForkDay: '2026-10-20', today: TODAY }), { draw: false, reuse: false, reason: 'fork-within-7d' });
  assert.equal(draw.drawDecision({ decision, existing: null, lastForkDay: '2026-10-20', today: TODAY, force: true }).draw, true);
});

test('latestForkDay is the newest PRED# row day of the thread', () => {
  assert.equal(draw.latestForkDay([{ SK: '2026-10-01' }, { SK: '2026-10-15' }, { SK: 'junk' }]), '2026-10-15');
  assert.equal(draw.latestForkDay([]), null);
});

// ---------- output shape ----------

test('output shape: one outcome = one scenario whose label is the event, with its own p, due and source', () => {
  const parsed = draw.outcomesToScenarios({ precedents: [{ case: 'x' }], outcomes: [out()], winners: ['A'], losers: ['B'] });
  assert.equal(parsed.unit, 'outcome');
  assert.equal(parsed.outcomes, undefined);
  const r = lib.buildGatedScenarios(parsed.scenarios, { generatedAtDay: TODAY, fallbackYear: 2026, pk: 'PRED#t-1', sk: TODAY, snippets: [], priorTexts: [], outcomeMode: true });
  assert.deepEqual(r.scenarios, [{
    label: 'Parliament passes the port labour bill',
    probabilityRange: '40%',
    probability: 0.4,
    horizon: 'by 2026-11-20',
    rationale: 'Base rate from precedents.',
    triggers: [{
      id: '0-0', text: 'Parliament passes the port labour bill', deadline: '2026-11-20', status: 'pending',
      qid: r.scenarios[0].triggers[0].qid, question: true, p: 40, resolutionSource: 'Official Gazette of Germany', resolver: 'human',
    }],
    scoreable: true,
  }]);
  assert.match(r.scenarios[0].triggers[0].qid, /^[0-9a-f]{20}$/);
  assert.equal(r.scenarios[0].triggers[0].qid, require('../src/questions').qidFor('PRED#t-1', TODAY, '0-0'));
  assert.equal(r.capture.questions.pEcho, 0);
  assert.deepEqual(Object.keys(r.capture).sort(), ['dropped', 'kept', 'methodologyVersion', 'questions']);
});

test('non-outcome content passes through the adapter unchanged', () => {
  const legacy = { scenarios: [{ label: 'Most Likely' }] };
  assert.equal(draw.outcomesToScenarios(legacy), legacy);
});

// ---------- G15 already true at the draw, G16 vague actor (lane Q) ----------

test('G15: an outcome matching an entry of the story dated on or before the draw is dropped; a later or unrelated entry is not', () => {
  const entries = [
    { date: '2026-10-20', title: 'Parliament passes the port labour bill', summary: 'Lawmakers voted on Tuesday.' },
    { date: '2026-10-23', title: 'EU opens an inquiry into port subsidies', summary: '' }, // after the draw: cannot make it true at the draw
    { date: '2026-10-21', title: 'Weather turns mild in Hamburg', summary: '' },
  ];
  const r = run([out({ text: 'Parliament passes the port labour bill' }), out({ text: 'EU opens an inquiry into port subsidies' }), out({ text: 'Court suspends the dockworkers strike' })], { priorEntries: entries });
  assert.deepEqual(keptTexts(r), ['EU opens an inquiry into port subsidies', 'Court suspends the dockworkers strike']);
  assert.equal(r.capture.dropped[0].gate, 'G15');
  assert.equal(run([out()], { priorEntries: [{ date: TODAY, title: 'Parliament passes the port labour bill', summary: '' }] }).capture.dropped[0].gate, 'G15'); // the draw day itself counts
  assert.equal(keptTexts(run([out()], { priorEntries: [] })).length, 1);
});

test('G16: generic actors are dropped; named institutions are kept', () => {
  const vague = ['The government passes the port labour bill', 'Authorities arrest the union leader', 'Officials impose a back-to-work order', 'The EU imposes sanctions on the shipping firm', 'The UN deploys observers to the port', 'Port staff end the strike and officials sign a deal'];
  for (const text of vague) {
    const r = run([out({ text })]);
    assert.equal(keptTexts(r).length, 0, text);
    assert.equal(r.capture.dropped[0].gate, 'G16', text);
  }
  const named = ['The European Commission imposes sanctions on the shipping firm', 'The EU Commission opens an inquiry into port subsidies', 'The UN Security Council adopts a resolution on the port', 'The German government signs the port labour bill', 'The government of Germany signs the port labour bill', 'Hamburg port authorities impose a back-to-work order', 'Parliament passes the port labour bill'];
  for (const text of named) assert.equal(keptTexts(run([out({ text })])).length, 1, text);
});

test('the prompt carries one line for each new gate', () => {
  const p = draw.buildPredictionPrompt(topic, 'October 22, 2026', 2026, {}, TODAY);
  assert.match(p, /already reports as done/);
  assert.match(p, /Name the exact institution/);
});
