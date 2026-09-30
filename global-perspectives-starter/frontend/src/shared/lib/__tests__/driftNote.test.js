import { describe, it, expect } from 'vitest';
import { isNoteFlagged, noteNumbersText, safeWhy, safeTriggerEvent } from '@/shared/lib/driftNote.js';

// The real Iran 2026-08-19 note (stored DRIFTLOG#), as the API returns it.
const iran = {
  asOf: '2026-08-19',
  changeScore: { from: 90, to: 90, delta: 0 },
  changeDimensions: { economic: { from: 80, to: 90, delta: 10 }, humanitarian: { from: 90, to: 70, delta: -20 } },
  triggerEvent: { topicId: 't', title: 'UAE announces indefinite trade embargo on Iran', date: '2026-08-19' },
  whyChanged: "The UAE's indefinite trade embargo on Iran directly escalates economic isolation, driving the economic score up from 80 to 90. This action also shifts the humanitarian score down as trade disruption worsens civilian conditions.",
};

describe('driftNote', () => {
  it('an unflagged note shows its own text and event unchanged', () => {
    expect(isNoteFlagged(iran)).toBe(false);
    expect(safeWhy(iran)).toBe(iran.whyChanged);
    expect(safeTriggerEvent(iran)).toEqual(iran.triggerEvent);
  });
  it('a backfilled-flag note (text untouched in storage) shows the numbers only, and no cited event', () => {
    const flagged = { ...iran, directionFlag: { backfilled: true, at: '2026-09-30T00:00:00Z' } };
    expect(safeWhy(flagged)).toBe('Economic risk rose 10 points (80 to 90); Humanitarian risk fell 20 points (90 to 70).');
    expect(safeWhy(flagged)).not.toMatch(/worsens|escalates/);
    expect(safeTriggerEvent(flagged)).toBeNull();
  });
  it('a new server-flagged note already carries a numbers-only sentence: shown as is', () => {
    const n = { whyChanged: 'Humanitarian risk fell 20 points (90 to 70). No listed event explains a move in this direction.', directionFlag: { attempts: 2, axes: ['humanitarian'] }, triggerEvent: null };
    expect(safeWhy(n)).toBe(n.whyChanged);
  });
  it('overall-score fallback when there is no axis vector; nothing at all when there are no numbers', () => {
    expect(noteNumbersText({ changeScore: { from: 60, to: 75 } })).toBe('Overall risk score rose 15 points (60 to 75).');
    expect(safeWhy({ whyChanged: 'x', directionFlag: { backfilled: true } })).toBeNull();
    expect(safeWhy(null)).toBeNull();
    expect(safeWhy({ whyChanged: '  ' })).toBeNull();
  });
});
