'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { conclusionMoved, findDrift, buildDriftPrompt, parseDriftResponse, axisMoves, changeDimensionsFrom } = require('../src/lib');

const snap = (dateKey, riskLevel, riskScore, trajectory = '', headline = '') => ({ dateKey, riskLevel, riskScore, trajectory, headline });
const dsnap = (dateKey, dimensions, riskLevel = 'elevated', riskScore = 60) => ({ dateKey, riskLevel, riskScore, dimensions, trajectory: 'x', headline: 'h' });

test('axisMoves: reports axes that shifted >=8; ignores small moves, nulls, missing vectors', () => {
  const p = { dimensions: { conflict: 40, economic: 70, humanitarian: null } };
  const c = { dimensions: { conflict: 75, economic: 66, humanitarian: 50 } };
  const m = axisMoves(p, c);
  assert.deepEqual(m.map((x) => x.axis).sort(), ['conflict']); // conflict +35; economic -4 (skip); humanitarian null→skip
  assert.equal(m[0].from, 40); assert.equal(m[0].to, 75); assert.equal(m[0].delta, 35);
  assert.deepEqual(axisMoves({}, {}), []); // no vectors → nothing (degrades gracefully)
});

test('conclusionMoved: an axis swing the scalar MAX hides still counts as a move', () => {
  // max stays ~70 (Δ5, below threshold), level same — but conflict 40→78 and economy 70→40 are huge.
  const prior = { riskLevel: 'elevated', riskScore: 70, dimensions: { conflict: 40, economic: 70 } };
  const cur = { riskLevel: 'elevated', riskScore: 75, dimensions: { conflict: 78, economic: 40 } };
  const moved = conclusionMoved(prior, cur);
  assert.equal(moved.scoreChg, false); // |75-70| = 5 < 8
  assert.equal(moved.levelChg, false);
  assert.equal(moved.axisChg, true);   // but axes moved
  assert.equal(moved.any, true);
  assert.equal(moved.axisMoves.length, 2);
});

test('changeDimensionsFrom: axisMoves[] → {axis:{from,to,delta}} map (undefined if none)', () => {
  const moved = conclusionMoved(dsnap('a', { economic: 30 }), dsnap('b', { economic: 72 }));
  assert.deepEqual(changeDimensionsFrom(moved), { economic: { from: 30, to: 72, delta: 42 } });
  assert.equal(changeDimensionsFrom({ axisMoves: [] }), undefined);
});

test('buildDriftPrompt: names the axis that moved so the LLM grounds on the right dimension', () => {
  const p = dsnap('2026-07-01', { conflict: 55, economic: 30 });
  const c = dsnap('2026-07-02', { conflict: 55, economic: 72 });
  const prompt = buildDriftPrompt('Japan', p, c, [{ topicId: 't1', title: 'yen hits 40-year low', date: '2026-07-02' }]);
  assert.match(prompt, /Axes that moved/);
  assert.match(prompt, /economic 30→72 \(\+42\)/);
});

test('conclusionMoved: level flip / big score / trajectory shift = moved; cosmetic = not', () => {
  assert.equal(conclusionMoved(snap('a', 'elevated', 65), snap('b', 'high', 85)).any, true);
  assert.equal(conclusionMoved(snap('a', 'high', 80), snap('b', 'high', 90)).any, true); // Δ10
  assert.equal(conclusionMoved(snap('a', 'high', 80), snap('b', 'high', 85)).any, false); // Δ5
  assert.equal(conclusionMoved(snap('a', 'high', 80, 'escalating war'), snap('b', 'high', 80, 'de-escalating peace talks')).any, true);
  assert.equal(conclusionMoved(snap('a', 'high', 80, 'x'), snap('b', 'high', 80, 'x')).any, false); // empty tokens
});

test('findDrift: returns the most recent MATERIALLY-different prior, skipping cosmetic days', () => {
  const d = findDrift([
    snap('2026-06-01', 'elevated', 60, 'calm', 'A'),
    snap('2026-06-02', 'high', 85, 'tense', 'B'),
    snap('2026-06-03', 'high', 85, 'tense', 'B reworded'),
  ]);
  assert.ok(d);
  assert.equal(d.prior.dateKey, '2026-06-01');
  assert.equal(d.current.dateKey, '2026-06-03');
  assert.equal(d.moved.levelChg, true);
});

test('findDrift: null when no material move / too few', () => {
  assert.equal(findDrift([snap('2026-06-01', 'high', 80)]), null);
  assert.equal(findDrift([snap('a', 'high', 80, 't'), snap('b', 'high', 82, 't')]), null);
});

test('buildDriftPrompt: numbers events and forbids invention', () => {
  const p = buildDriftPrompt('Ukraine',
    snap('2026-06-30', 'elevated', 68, '', 'prior'),
    snap('2026-07-01', 'high', 82, '', 'now'),
    [{ topicId: 't1', title: 'Russia strikes Kyiv', date: '2026-07-01' }]);
  assert.match(p, /\[1\] \(2026-07-01\) Russia strikes Kyiv/);
  assert.match(p, /Do NOT invent/i);
  assert.match(p, /triggerEventNumber/);
});

test('parseDriftResponse: valid event number → triggerEvent', () => {
  const events = [{ topicId: 't1', title: 'Strike', date: '2026-07-01' }];
  const r = parseDriftResponse('{"triggerEventNumber":1,"whyChanged":"Risk rose after the strike.","noSingleDriver":false}', events);
  assert.equal(r.noSingleDriver, false);
  assert.deepEqual(r.triggerEvent, { topicId: 't1', title: 'Strike', date: '2026-07-01' });
});

test('parseDriftResponse: out-of-range number → dropped to noSingleDriver', () => {
  const events = [{ topicId: 't1', title: 'Strike', date: '2026-07-01' }];
  const r = parseDriftResponse('{"triggerEventNumber":99,"whyChanged":"Something happened.","noSingleDriver":false}', events);
  assert.equal(r.noSingleDriver, true);
  assert.equal(r.triggerEvent, null);
});

test('parseDriftResponse: explicit noSingleDriver (0) + empty/garbage handled', () => {
  const events = [{ topicId: 't1', title: 'Strike' }];
  const nd = parseDriftResponse('{"triggerEventNumber":0,"noSingleDriver":true,"whyChanged":"No single event explains it."}', events);
  assert.equal(nd.noSingleDriver, true);
  assert.equal(parseDriftResponse('not json', events), null);
  assert.equal(parseDriftResponse('{"triggerEventNumber":1,"whyChanged":""}', events), null); // no why
});

const { threadConclusionMoved, findThreadDrift } = require('../src/lib');
const tsnap = (dateKey, riskScore, threadTitle = '', trajectory = '') => ({ dateKey, riskScore, threadTitle, trajectory });

test('threadConclusionMoved: score jump / title change / trajectory shift = moved; reword = not', () => {
  assert.equal(threadConclusionMoved(tsnap('a', 40, 'Talks stall'), tsnap('b', 55, 'Talks stall')).any, true); // Δ15
  assert.equal(threadConclusionMoved(tsnap('a', 40, 'Ceasefire holds in region'), tsnap('b', 42, 'War resumes as ceasefire collapses')).any, true); // title
  assert.equal(threadConclusionMoved(tsnap('a', 40, 'Talks continue', 'diplomacy proceeds slowly'), tsnap('b', 42, 'Talks continue', 'diplomacy proceeds slowly')).any, false); // stable
});

test('findThreadDrift: finds most recent materially-different prior; null when stable', () => {
  const d = findThreadDrift([
    tsnap('2026-06-01', 30, 'Quiet diplomacy', 'calm'),
    tsnap('2026-06-02', 70, 'Open conflict erupts', 'escalating fast'),
  ]);
  assert.ok(d);
  assert.equal(d.prior.dateKey, '2026-06-01');
  assert.equal(findThreadDrift([tsnap('a', 50, 'X', 't'), tsnap('b', 53, 'X', 't')]), null); // Δ3, same title/traj
});

const { findAllDrifts } = require('../src/lib');
test('findAllDrifts: returns every consecutive material move (the chain), not just the latest', () => {
  const snaps = [
    { dateKey: '2026-06-25', riskLevel: 'elevated', riskScore: 50, trajectory: 'calm' },
    { dateKey: '2026-06-26', riskLevel: 'elevated', riskScore: 50, trajectory: 'calm' },   // no move
    { dateKey: '2026-06-27', riskLevel: 'high', riskScore: 62, trajectory: 'escalating' },  // move 1
    { dateKey: '2026-06-28', riskLevel: 'high', riskScore: 80, trajectory: 'war footing' }, // move 2 (Δ18)
  ];
  const d = findAllDrifts(snaps);
  assert.equal(d.length, 2);
  assert.equal(d[0].current.dateKey, '2026-06-27');
  assert.equal(d[1].current.dateKey, '2026-06-28');
});
