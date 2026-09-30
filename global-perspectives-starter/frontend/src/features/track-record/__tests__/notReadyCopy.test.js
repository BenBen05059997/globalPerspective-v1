import { describe, it, expect } from 'vitest';
import { statusNotes, accuracyNotReady, calibrationNotReady, boardStatus, drawShort, pilotNote } from '@/features/track-record/lib/notReadyCopy.js';
import { estimateAccuracyWindow } from '@/features/track-record/lib/accuracyEstimate.js';

const NOW = new Date('2026-10-07T12:00:00Z');
const wk = (over = {}) => ({ weekId: '2026-W41', weekStart: '2026-10-05', commit: { hash: 'abcdef0123456789', committedAt: '2026-10-01T10:30:00Z' }, reveal: null, drawn: false, picked: null, ...over });
const board = (over = {}) => ({ issued: 30, warmUp: 4, firstIssuedAt: '2026-10-01T05:00:00Z', firstCommit: { weekId: '2026-W41', committedAt: '2026-10-01T10:30:00Z' }, method: { K: 22 }, weeks: [wk()], sampled: [], counts: { locked: 0, resolved: 0, void: 0, awaiting: 0, pastDeadlineUnchecked: 0 }, ...over });

describe('statusNotes', () => {
  it('no questions block: "not started" with no date at all', () => {
    const n = statusNotes(null, NOW);
    expect(n).toHaveLength(1);
    expect(n[0].text).toMatch(/have not started yet/);
    expect(n[0].text).not.toMatch(/\d{4}/);
  });
  it('questions but no commitment: names the first issue date, promises no date', () => {
    const n = statusNotes({ issued: 3, firstIssuedAt: '2026-10-01T05:00:00Z', firstCommit: null }, NOW);
    expect(n[0].text).toMatch(/since Oct 1 2026/);
    expect(n[0].text).toMatch(/warm-up/);
  });
  it('a committed week that has not started yet says when it starts and how many are warm-up', () => {
    const n = statusNotes(board(), new Date('2026-10-03T12:00:00Z'));
    expect(n[0].text).toMatch(/first weekly sample starts on Oct 5 2026/);
    expect(n[0].text).toMatch(/4 so far/);
  });
  it('the open week is "locked but not drawn" with the commitment, the end date and the draw date', () => {
    const n = statusNotes(board(), NOW);
    expect(n[0].text).toMatch(/locked but not drawn/);
    expect(n[0].text).toMatch(/abcdef01…/);
    expect(n[0].text).toMatch(/ends Oct 11 2026/);
    expect(n[0].text).toMatch(/published on Oct 12 2026/);
  });
  it('first results line is computed from the earliest real deadline (deadline + 3 days, next Monday)', () => {
    const n = statusNotes(board({ weeks: [wk({ drawn: true })], sampled: [{ deadline: '2026-10-20' }, { deadline: '2026-11-30' }], counts: { locked: 2, resolved: 0, void: 0 } }), NOW);
    const t = n.find((x) => x.key === 'first-results').text;
    expect(t).toMatch(/from Oct 20 2026/);
    expect(t).toMatch(/week of Oct 26 2026/);
  });
  it('the first-results line goes away once anything is resolved or void', () => {
    const n = statusNotes(board({ weeks: [wk({ drawn: true })], sampled: [{ deadline: '2026-10-20' }], counts: { locked: 1, resolved: 1, void: 0 } }), NOW);
    expect(n.find((x) => x.key === 'first-results')).toBeUndefined();
  });
});

describe('accuracyNotReady', () => {
  it('says "not ready yet", the counts, and an estimate range computed from the sample', () => {
    const q = board();
    const est = estimateAccuracyWindow({ sampled: q.sampled, weeks: q.weeks, now: NOW });
    const t = accuracyNotReady(q, est);
    expect(t).toMatch(/Accuracy score: not ready yet/);
    expect(t).toMatch(/after 150 questions are resolved \(now 0, void 0, awaiting 0\)/);
    expect(t).toMatch(/Expected between .* and .* \(estimate/);
    expect(t).toMatch(/0–25% voided/);
  });
  it('with nothing to base an estimate on, it gives no date', () => {
    const t = accuracyNotReady(board({ weeks: [] }), null);
    expect(t).not.toMatch(/Expected/);
    expect(t).not.toMatch(/\b20\d\d\b/);
  });
});

describe('calibrationNotReady / boardStatus / drawShort / pilotNote', () => {
  it('calibration needs 6 months since the first draw; the date is at least that', () => {
    const q = board({ weeks: [wk({ drawn: true })] });
    const t = calibrationNotReady(q, null, NOW);
    expect(t).toMatch(/not ready yet/);
    expect(t).toMatch(/Expected after about Apr 6 2027 \(estimate\)/);
  });
  it('board: none locked / locked but none resolved with the first deadline in days', () => {
    expect(boardStatus(board(), NOW)).toBe('No questions are locked yet.');
    const q = board({ sampled: [{ deadline: '2026-10-20' }], counts: { locked: 1, resolved: 0, void: 0 } });
    expect(boardStatus(q, NOW)).toBe('1 question locked, none resolved yet. The first deadline is Oct 20 2026 (13 days).');
    expect(boardStatus(board({ counts: { locked: 3, resolved: 1, void: 0 } }), NOW)).toBeNull();
  });
  it('a short draw is never padded, and says so', () => {
    expect(drawShort({ drawn: true, picked: 9, weekStart: '2026-10-05' }, 22)).toMatch(/Only 9 stories .* never padded/);
    expect(drawShort({ drawn: true, picked: 22, weekStart: '2026-10-05' }, 22)).toBeNull();
    expect(drawShort({ drawn: false, picked: null, weekStart: '2026-10-05' }, 22)).toBeNull();
  });
  it('the pilot is one dated fact', () => {
    expect(pilotNote('2026-07-24T22:22:14Z', 122)).toMatch(/122 triggers were settled once, on Jul 24 2026/);
    expect(pilotNote(null, 122)).toBeNull();
  });
});
