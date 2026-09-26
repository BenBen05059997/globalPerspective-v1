import { describe, it, expect, vi } from 'vitest';
import {
  axisMoves,
  notesSince,
  snapshotPairForNote,
  rowFromNote,
  buildDeskRows,
  isStaleSince,
  readLastVisit,
  writeLastVisit,
  LAST_VISIT_KEY,
} from '@/features/account/lib/desk';

describe('axisMoves', () => {
  it('reports only axes with |delta| >= min (default 10)', () => {
    const prev = { dimensions: { conflict: 40, political: { score: 30 }, economic: 50, humanitarian: 20 } };
    const curr = { dimensions: { conflict: 45, political: { score: 42 }, economic: 50, humanitarian: 5 } };
    const moves = axisMoves(prev, curr);
    // humanitarian moves -15 (|15|), political moves +12 (|12|) — worst-first by |delta|
    expect(moves.map((m) => m.axis)).toEqual(['humanitarian', 'political']);
    expect(moves[0].delta).toBe(-15);
  });

  it('respects a custom min threshold', () => {
    const prev = { dimensions: { conflict: 40 } };
    const curr = { dimensions: { conflict: 45 } };
    expect(axisMoves(prev, curr, 10)).toEqual([]);
    expect(axisMoves(prev, curr, 3)).toHaveLength(1);
  });

  it('skips an axis missing from either side rather than treating it as 0', () => {
    const prev = { dimensions: { conflict: 40 } };
    const curr = { dimensions: { political: 90 } };
    expect(axisMoves(prev, curr)).toEqual([]);
  });

  it('handles missing snapshots without throwing', () => {
    expect(axisMoves(null, null)).toEqual([]);
    expect(axisMoves(undefined, { dimensions: { conflict: 10 } })).toEqual([]);
  });
});

describe('notesSince', () => {
  const notes = [
    { asOf: '2026-08-17' },
    { asOf: '2026-08-18' },
    { asOf: '2026-08-19' },
  ];

  it('returns notes on or after lastVisit\'s calendar day, newest first', () => {
    const result = notesSince(notes, '2026-08-17T12:00:00.000Z');
    expect(result.map((n) => n.asOf)).toEqual(['2026-08-19', '2026-08-18', '2026-08-17']);
  });

  it('F1.3: a note dated the same calendar day as the last visit is shown, not hidden', () => {
    // The last visit was at 08:00 on 2026-08-19; a note dated 2026-08-19 (asOf is a date key, no
    // time-of-day) could have been written any time that day, including after the visit — it must
    // not be hidden just because 00:00 < 08:00.
    const sameDayNotes = [{ asOf: '2026-08-18' }, { asOf: '2026-08-19' }];
    const result = notesSince(sameDayNotes, '2026-08-19T08:00:00.000Z');
    expect(result.map((n) => n.asOf)).toEqual(['2026-08-19']);
  });

  it('returns nothing without a last-visit timestamp', () => {
    expect(notesSince(notes, null)).toEqual([]);
    expect(notesSince(notes, undefined)).toEqual([]);
  });

  it('is empty-safe', () => {
    expect(notesSince([], '2026-08-17')).toEqual([]);
    expect(notesSince(undefined, '2026-08-17')).toEqual([]);
  });
});

describe('snapshotPairForNote', () => {
  const snapshots = [
    { dateKey: '2026-08-16', riskScore: 70 },
    { dateKey: '2026-08-17', riskScore: 80 },
    { dateKey: '2026-08-18', riskScore: 90 },
  ];

  it('returns the snapshot immediately before the note date', () => {
    const pair = snapshotPairForNote(snapshots, '2026-08-18');
    expect(pair.prev.dateKey).toBe('2026-08-17');
    expect(pair.curr.dateKey).toBe('2026-08-18');
  });

  it('returns null when the date is the earliest snapshot or not found', () => {
    expect(snapshotPairForNote(snapshots, '2026-08-16')).toBeNull();
    expect(snapshotPairForNote(snapshots, '2026-09-01')).toBeNull();
    expect(snapshotPairForNote([], '2026-08-16')).toBeNull();
  });
});

describe('rowFromNote', () => {
  it('prefers computed axis moves over changeScore when snapshots cover the note', () => {
    const snapshots = [
      { dateKey: '2026-08-17', dimensions: { political: 75 } },
      { dateKey: '2026-08-18', dimensions: { political: 85 } },
    ];
    const note = {
      asOf: '2026-08-18',
      changeScore: { from: 70, to: 75 },
      triggerEvent: { title: 'Deadline expires', date: '2026-08-18', threadId: 'thread-1' },
      whyChanged: 'Explanation text',
    };
    const row = rowFromNote(note, 'Iran', snapshots);
    expect(row.axisLine).toBe('POLITICAL 75→85');
    expect(row.triggerTitle).toBe('Deadline expires');
    expect(row.triggerHref).toContain('thread-1');
    expect(row.why).toBe('Explanation text');
    expect(row.country).toBe('Iran');
  });

  it('falls back to the overall changeScore when snapshots do not cover the note', () => {
    const note = { asOf: '2026-08-18', changeScore: { from: 70, to: 90 } };
    const row = rowFromNote(note, 'Iran', []);
    expect(row.axisLine).toBe('70→90');
  });

  it('never links a topicId as if it were a thread id (plain text only)', () => {
    const r = rowFromNote({ asOf: '2026-08-18', triggerEvent: { title: 'X', date: '2026-08-18', topicId: 'UAE imposes embargo-5' } }, 'Iran', []);
    expect(r.triggerHref).toBeNull();
  });

  it('has no trigger link when threadId is absent (plain text only)', () => {
    const note = { asOf: '2026-08-18', triggerEvent: { title: 'Some event', date: '2026-08-18' } };
    const row = rowFromNote(note, 'Iran', []);
    expect(row.triggerHref).toBeNull();
    expect(row.triggerTitle).toBe('Some event');
  });
});

describe('buildDeskRows', () => {
  const countryResults = [
    {
      country: 'Iran',
      snapshots: [],
      driftNotes: [
        { asOf: '2026-08-17', changeScore: { from: 75, to: 85 } },
        { asOf: '2026-08-19', changeScore: { from: 80, to: 90 } },
      ],
      driftNotesGated: false,
    },
  ];

  it('first visit (no stored timestamp): newest 5 across all follows', () => {
    const { rows, firstVisit } = buildDeskRows(countryResults, null);
    expect(firstVisit).toBe(true);
    expect(rows.map((r) => r.asOf)).toEqual(['2026-08-19', '2026-08-17']);
  });

  it('returning visit: only notes newer than lastVisit', () => {
    const { rows, firstVisit } = buildDeskRows(countryResults, '2026-08-18T00:00:00.000Z');
    expect(firstVisit).toBe(false);
    expect(rows.map((r) => r.asOf)).toEqual(['2026-08-19']);
  });

  it('skips a country result that errored', () => {
    const withError = [...countryResults, { country: 'Yemen', error: 'boom', driftNotes: [{ asOf: '2026-08-20' }] }];
    const { rows } = buildDeskRows(withError, null);
    expect(rows.every((r) => r.country !== 'Yemen')).toBe(true);
  });

  it('surfaces anyGated when a country result is gated', () => {
    const gated = [{ country: 'Iran', snapshots: [], driftNotes: [], driftNotesGated: true }];
    const { anyGated } = buildDeskRows(gated, null);
    expect(anyGated).toBe(true);
  });
});

describe('isStaleSince', () => {
  const now = new Date('2026-09-26T00:00:00.000Z').getTime();

  it('returns null for a recent note', () => {
    expect(isStaleSince('2026-09-25', now)).toBeNull();
  });

  it('returns a formatted date once the newest note is 7+ days old', () => {
    expect(isStaleSince('2026-09-11', now)).toBe('Sep 11');
  });

  it('is null with no input', () => {
    expect(isStaleSince(null, now)).toBeNull();
  });
});

describe('last-visit storage (throwing storage safe)', () => {
  it('reads and writes with a normal storage stub', () => {
    const store = new Map();
    const storage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
    };
    expect(readLastVisit(storage)).toBeNull();
    expect(writeLastVisit('2026-09-26T00:00:00.000Z', storage)).toBe(true);
    expect(readLastVisit(storage)).toBe('2026-09-26T00:00:00.000Z');
    expect(store.get(LAST_VISIT_KEY)).toBe('2026-09-26T00:00:00.000Z');
  });

  it('never throws when storage.getItem/setItem throw', () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error('blocked'); }),
      setItem: vi.fn(() => { throw new Error('blocked'); }),
    };
    expect(() => readLastVisit(storage)).not.toThrow();
    expect(readLastVisit(storage)).toBeNull();
    expect(() => writeLastVisit('x', storage)).not.toThrow();
    expect(writeLastVisit('x', storage)).toBe(false);
  });

  it('returns null/false when there is no storage at all', () => {
    expect(readLastVisit(null)).toBeNull();
    expect(writeLastVisit('x', null)).toBe(false);
  });
});
