import { describe, it, expect } from 'vitest';
import { checkDirection, checkDirectionInText } from '../directionCheck.js';

// Real drift note, fetched live from the country_history proxy action for Iran
// (2026-09-27, `countryName: "Iran"`, the note asOf 2026-08-19) — frozen here as a fixture
// per the monitor's instruction, rather than re-fetched live in the test suite.
const IRAN_2026_08_19_WHY_CHANGED =
  "The UAE's indefinite trade embargo on Iran directly escalates economic isolation, driving " +
  'the economic score up from 80 to 90. This action also shifts the humanitarian score down as ' +
  'trade disruption worsens civilian conditions, while the prior missile attack (event 6) is the ' +
  'immediate cause but the embargo is the structural change.';

describe('checkDirection', () => {
  it('flags "worse" text against a score that moved DOWN (improved)', () => {
    const r = checkDirection({ text: 'The embargo shifts conditions worse as pressure builds.', scoreBefore: 60, scoreAfter: 45 });
    expect(r.flag).toBe(true);
    expect(r.reason).toMatch(/worse.*score moved down/i);
  });

  it('flags "improved" text against a score that moved UP (worsened)', () => {
    const r = checkDirection({ text: 'Conditions have improved since the ceasefire.', scoreBefore: 30, scoreAfter: 50 });
    expect(r.flag).toBe(true);
  });

  it('does not flag when text direction matches the score movement', () => {
    expect(checkDirection({ text: 'Risk deteriorated further.', scoreBefore: 40, scoreAfter: 55 }).flag).toBe(false);
    expect(checkDirection({ text: 'The situation has cooled.', scoreBefore: 55, scoreAfter: 40 }).flag).toBe(false);
  });

  it('does not flag when there is nothing to check (missing scores, equal scores, or neutral text)', () => {
    expect(checkDirection({ text: 'A neutral update with no directional words.', scoreBefore: 40, scoreAfter: 55 }).flag).toBe(false);
    expect(checkDirection({ text: 'Things got worse.', scoreBefore: 50, scoreAfter: 50 }).flag).toBe(false);
    expect(checkDirection({ text: 'Things got worse.' }).flag).toBe(false);
    expect(checkDirection({ scoreBefore: 10, scoreAfter: 20 }).flag).toBe(false);
  });

  it('does not flag ambiguous text using both "worse" and "better" wording', () => {
    expect(checkDirection({ text: 'Some indicators worsened while others improved.', scoreBefore: 40, scoreAfter: 55 }).flag).toBe(false);
  });
});

describe('checkDirectionInText — real Iran drift note (2026-08-19)', () => {
  it('flags the humanitarian clause (says "down" but describes worsening)', () => {
    const flags = checkDirectionInText(IRAN_2026_08_19_WHY_CHANGED);
    const humanitarian = flags.find((f) => f.axis === 'humanitarian');
    expect(humanitarian).toBeTruthy();
    expect(humanitarian.direction).toBe('down');
    expect(humanitarian.reason).toMatch(/humanitarian score went down.*worsening/i);
  });

  it('does NOT flag the economic clause (says "up" and describes escalation — consistent)', () => {
    const flags = checkDirectionInText(IRAN_2026_08_19_WHY_CHANGED);
    expect(flags.find((f) => f.axis === 'economic')).toBeUndefined();
  });

  it('flags exactly one clause for this note', () => {
    expect(checkDirectionInText(IRAN_2026_08_19_WHY_CHANGED)).toHaveLength(1);
  });

  it('returns [] for text with no explicit "<axis> score up/down" claim, or empty input', () => {
    expect(checkDirectionInText('Risk deteriorated further this week.')).toEqual([]);
    expect(checkDirectionInText('')).toEqual([]);
    expect(checkDirectionInText(null)).toEqual([]);
  });

  it('does not flag a consistent "up" + worsening claim', () => {
    expect(checkDirectionInText('The conflict score up as fighting intensifies.')).toEqual([]);
  });
});
