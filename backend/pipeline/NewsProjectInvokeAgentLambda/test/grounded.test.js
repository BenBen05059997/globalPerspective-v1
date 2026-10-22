'use strict';

// 2026-10-17 grounded-forecast tests (G13 grounded-date gate, thread-day reuse, token-usage parsing).
// G13 cases are the REAL invented calendar facts found in that day's research briefings; run with `node --test`.

const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../src/lib');

const TODAY = '2026-10-17';
const run = (scenarios, inputText) => lib.buildGatedScenarios(scenarios, { generatedAtDay: TODAY, fallbackYear: 2026, pk: 'PRED#t', sk: TODAY, snippets: [], inputText });
const trig = (text, deadline) => ({ text, deadline, p: 40, resolution_source: 'Reuters or AP wire report' });

const HORMUZ_INPUT = 'Iran and the US trade threats over the Strait of Hormuz. Tanker traffic fell 30% this week. Talks are planned for 3 November in Muscat. Verified: Iran: President Pezeshkian.';

test('G13 demotes a trigger that cites the invented G20 New Delhi Nov 15-16 summit', () => {
  const out = run([{ label: 'Most Likely', probability_range: '40-50%', rationale: 'Pressure builds.', triggers: [
    trig('Iran and the US announce a Hormuz shipping deal at the G20 Summit in New Delhi on Nov 15-16 2026', '2026-11-30'),
  ] }], HORMUZ_INPUT);
  const t = out.scenarios[0].triggers[0];
  assert.equal(t.question, false);
  assert.equal(t.qid, undefined);
  const d = out.capture.dropped.find(x => x.gate === 'G13');
  assert.ok(d, 'recorded in capture.dropped');
  assert.match(d.why, /G20 Summit/);
  assert.match(d.why, /Nov 15/);
  assert.equal(out.capture.questions.kept, 0);
});

test('G13 demotes the invented UNSCR 2231 / Dec 2026 expiry', () => {
  const out = run([{ label: 'Pessimistic', probability_range: '20%', rationale: 'x', triggers: [
    trig('UNSCR 2231 remaining provisions expire Dec 2026 and the snapback is invoked', '2026-12-31'),
  ] }], HORMUZ_INPUT);
  assert.equal(out.scenarios[0].triggers[0].question, false);
  assert.equal(out.capture.dropped[0].gate, 'G13');
  assert.match(out.capture.dropped[0].why, /2231/);
});

test('G13 demotes the invented WHO Executive Board Oct 20-24 session', () => {
  const input = 'Kenya confirms Ebola cases. The WHO says it is monitoring the outbreak.'; // "WHO" is in the input, the Board session is not
  const out = run([{ label: 'Most Likely', probability_range: '60%', rationale: 'x', triggers: [
    trig('WHO Executive Board special session Oct 20-24 declares a public health emergency', '2026-11-10'),
  ] }], input);
  assert.equal(out.scenarios[0].triggers[0].question, false);
  const why = out.capture.dropped.find(d => d.gate === 'G13').why;
  assert.match(why, /WHO Executive Board/);
  assert.match(why, /Oct 20/);
});

test('G13 lets grounded dates and events through: dates and names that ARE in the input', () => {
  const input = 'Delegates confirm the G20 Summit will be held in Miami on December 14-15. Talks in Geneva resume on Nov 3.';
  const out = run([{ label: 'Most Likely', probability_range: '55-60%', rationale: 'The G20 Summit on December 14 is the next test. Talks resume Nov 3.', triggers: [
    trig('Leaders sign a joint statement on Hormuz at the G20 Summit on December 14', '2026-12-15'),
    trig('Geneva talks on Nov 3 produce a signed framework', '2026-11-10'),
  ] }], input);
  assert.deepEqual(out.capture.dropped, []);
  assert.deepEqual(out.scenarios[0].triggers.map(t => t.question), [true, true]);
  assert.equal(out.scenarios[0].rationale, 'The G20 Summit on December 14 is the next test. Talks resume Nov 3.');
});

test('G13 exempts the trigger deadline (a forecast window) and the same date restated in the text', () => {
  const out = run([{ label: 'Most Likely', probability_range: '40%', rationale: 'x', triggers: [
    trig('Iran releases the seized tanker by 2026-11-20', '2026-11-20'),
    trig('Oman brokers a Muscat accord on shipping insurance by November 20, 2026', '2026-11-20'),
  ] }], HORMUZ_INPUT);
  assert.deepEqual(out.capture.dropped, []);
  assert.equal(out.capture.questions.kept, 2);
});

test('G13 strips ungrounded-date sentences from the rationale once, and reports them for capture.dropped', () => {
  const parsed = { scenarios: [{ label: 'Most Likely', rationale: 'Tanker traffic is falling and Tehran holds the initiative. Pressure peaks before the G20 Summit in mid-November. Talks in Muscat on 3 November are the real test.', triggers: [trig('Iran reopens the strait by 2026-12-01', '2026-12-01')] }] };
  const g = lib.groundForecastContent(parsed, HORMUZ_INPUT, TODAY);
  assert.equal(g.parsed.scenarios[0].rationale, 'Tanker traffic is falling and Tehran holds the initiative. Talks in Muscat on 3 November are the real test.');
  assert.equal(g.removed.length, 1);
  assert.equal(g.removed[0].gate, 'G13');
  assert.equal(g.removed[0].field, 'rationale');
  assert.match(g.removed[0].text, /G20 Summit/);
  assert.match(parsed.scenarios[0].rationale, /G20/); // input not mutated
  // buildGatedScenarios does not strip again: it receives the grounded copy
  assert.equal(run(g.parsed.scenarios, HORMUZ_INPUT).scenarios[0].rationale, g.parsed.scenarios[0].rationale);
});

test('G13 demotes the invented Sri Lanka Cabinet Committee meeting through the generic event rule', () => {
  const out = run([{ label: 'Most Likely', probability_range: '50%', rationale: 'x', triggers: [
    trig('Sri Lanka Cabinet Committee on Economic Management meeting approves the fuel plan', '2026-11-05'),
  ] }], 'Sri Lanka faces a nationwide blackout; fuel stocks are low.');
  assert.equal(out.scenarios[0].triggers[0].question, false);
  assert.match(out.capture.dropped[0].why, /Cabinet Committee/);
});

test('G13 passes a named event that IS in the input', () => {
  const out = run([{ label: 'Most Likely', probability_range: '50%', rationale: 'x', triggers: [
    trig('Sri Lanka Cabinet Committee on Economic Management approves the fuel plan', '2026-11-05'),
  ] }], 'The Cabinet Committee on Economic Management is due to review the fuel plan.');
  assert.equal(out.scenarios[0].triggers[0].question, true);
  assert.deepEqual(out.capture.dropped, []);
});

test('G13 does not gate past-dated precedent references or an organisation name ending in "Committee of"', () => {
  const out = run([{ label: 'Most Likely', probability_range: '50%', rationale: 'Precedent: the blackout of August 2020 lasted two days, and the December 2018 protests faded. The International Committee of the Red Cross stays neutral.', triggers: [
    trig('Iran reopens the strait by 2026-12-01', '2026-12-01'),
  ] }], HORMUZ_INPUT);
  assert.deepEqual(out.capture.dropped, []);
  assert.match(out.scenarios[0].rationale, /August 2020/);
  // but a bare future-looking month/day, or a future year, is still checked
  assert.equal(lib.ungroundedClaims('Talks resume in December 2026.', lib.buildGroundIndex(HORMUZ_INPUT, TODAY)).length, 1);
});

test('G13 is off when no inputText is supplied (old callers unchanged)', () => {
  const out = lib.buildGatedScenarios([{ label: 'x', rationale: 'The G20 Summit on Nov 15 matters.', triggers: [trig('G20 Summit Nov 15-16 2026 in New Delhi ends', '2026-11-16')] }], { generatedAtDay: TODAY, fallbackYear: 2026, pk: 'PRED#t', sk: TODAY });
  assert.equal(out.capture.dropped.filter(d => d.gate === 'G13').length, 0);
  assert.equal(out.scenarios[0].rationale, 'The G20 Summit on Nov 15 matters.');
});

test('P3 thread lookup: today\'s archive entries on the same thread, de-duplicated', () => {
  const entries = [
    { topicId: 'a-1', threadId: 'thread-x' }, { topicId: 'a-1', threadId: 'thread-x' },
    { topicId: 'b-2', threadId: 'thread-y' }, { topicId: 'c-3', threadId: 'thread-x' }, { threadId: 'thread-x' },
  ];
  assert.deepEqual(lib.threadSiblingsToday(entries, 'thread-x'), ['a-1', 'c-3']);
  assert.deepEqual(lib.threadSiblingsToday(entries, null), []);
  assert.deepEqual(lib.threadSiblingsToday(undefined, 'thread-x'), []);
});

test('P3 + PRED gap: a forecast stored today (original or copy) is reused once per day even if the sources changed', () => {
  assert.equal(lib.forecastedOn({ generatedAt: '2026-10-17T03:10:00.000Z' }, TODAY), true);
  assert.equal(lib.forecastedOn({ generatedAt: '2026-10-16T23:59:00.000Z' }, TODAY), false);
  assert.equal(lib.forecastedOn(null, TODAY), false);
  const copy = lib.restampFields({ contentFormat: 'json', sourceFingerprint: 'old', generatedAt: '2026-10-17T03:10:00.000Z' }, 'gen-2', 100, 1);
  assert.equal(lib.forecastedOn(copy, TODAY), true); // copies keep generatedAt
  assert.deepEqual(lib.decideReuse({ kind: 'prediction', existing: copy, fingerprint: 'new', predictionLoggedToday: lib.forecastedOn(copy, TODAY) }), { reuse: true, reason: 'once-per-day' });
});

test('PROMPT_VERSION is 3 and methodology stays 1 (the study splits on promptVersion)', () => {
  assert.equal(lib.PROMPT_VERSION, 3);
  assert.equal(lib.METHODOLOGY_VERSION, 1);
});
