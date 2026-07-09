/**
 * Tests for the ```gp-struct``` parser (utils/analysisStruct.js) — the optional
 * machine-readable index appended to Analysis Studio output. See
 * ANALYSIS_PRO_STRUCTURE_PLAN.md §P2.2.
 */

import { describe, it, expect } from 'vitest';
import { extractStruct, validateStruct } from '../utils/analysisStruct';

const GOOD_PROSE = [
  'Bottom line: the ceasefire is fragile.',
  '',
  '## Key judgments',
  '- Talks continue: likely (55–80%), moderate confidence.',
  '- Collapse within 30 days: unlikely (20–45%), low confidence.',
  '',
  'Scenario A holds together with a probability of 65%. Scenario B, a collapse, sits at 20%.',
  'Brent crude would move up on a collapse; the mechanism is supply risk through the strait.',
].join('\n');

const GOOD_BLOCK = `{
  "scenarios": [
    { "name": "Holds", "pLow": 55, "pHigh": 65 },
    { "name": "Collapse", "pLow": 20, "pHigh": 45 }
  ],
  "indicators": [
    { "signal": "Talks resume publicly", "confirms": "Holds", "kills": "Collapse" }
  ],
  "ripples": [
    { "instrument": "Brent crude", "direction": "up", "magnitude": "moderate" }
  ]
}`;

function fenced(prose, block) {
  return `${prose}\n\n\`\`\`gp-struct\n${block}\n\`\`\`\n`;
}

describe('extractStruct', () => {
  it('parses a well-formed fence and strips it from the prose', () => {
    const text = fenced(GOOD_PROSE, GOOD_BLOCK);
    const { struct, prose } = extractStruct(text);
    expect(struct).toBeTruthy();
    expect(struct.scenarios).toHaveLength(2);
    expect(struct.indicators).toHaveLength(1);
    expect(struct.ripples).toHaveLength(1);
    expect(prose).not.toContain('gp-struct');
    expect(prose).not.toContain('```');
    expect(prose).toContain('Bottom line');
  });

  it('returns null struct and the untouched text when there is no fence', () => {
    const { struct, prose } = extractStruct(GOOD_PROSE);
    expect(struct).toBeNull();
    expect(prose).toBe(GOOD_PROSE);
  });

  it('returns null struct + intact prose on malformed JSON (never throws)', () => {
    const text = fenced(GOOD_PROSE, '{ "scenarios": [ this is not json ');
    expect(() => extractStruct(text)).not.toThrow();
    const { struct, prose } = extractStruct(text);
    expect(struct).toBeNull();
    expect(prose).toContain('Bottom line');
    expect(prose).not.toContain('```');
  });

  it('handles non-string input without throwing', () => {
    expect(() => extractStruct(undefined)).not.toThrow();
    expect(() => extractStruct(null)).not.toThrow();
    const { struct, prose } = extractStruct(null);
    expect(struct).toBeNull();
    expect(prose).toBe('');
  });

  it('treats a non-object JSON value (e.g. an array or number) as no struct', () => {
    const text = fenced(GOOD_PROSE, '[1, 2, 3]');
    const { struct } = extractStruct(text);
    expect(struct).toBeNull();
  });

  it('strips a TRUNCATED (unclosed) fence to end-of-text — the token-cap case', () => {
    // The block comes last, so a max_tokens cutoff leaves an opening fence with no
    // closing ``` and half-emitted JSON. Seen live 2026-07-10: the partial block
    // leaked into the prose and false-triggered invented_figure.
    const text = `${GOOD_PROSE}\n\n\`\`\`gp-struct\n{ "scenarios": [ { "name": "Holds", "pLow": 55,`;
    const { struct, prose } = extractStruct(text);
    expect(struct).toBeNull();
    expect(prose).toBe(GOOD_PROSE);
    expect(prose).not.toContain('gp-struct');
    expect(prose).not.toContain('pLow');
  });
});

describe('validateStruct', () => {
  it('keeps a scenario whose probability digits literally appear in the prose', () => {
    const struct = { scenarios: [{ name: 'Holds', pLow: 55, pHigh: 65 }] };
    const out = validateStruct(struct, GOOD_PROSE);
    expect(out.scenarios).toEqual([{ name: 'Holds', pLow: 55, pHigh: 65 }]);
  });

  it('drops a scenario whose probability numbers do not appear anywhere in the prose', () => {
    const struct = {
      scenarios: [
        { name: 'Holds', pLow: 55, pHigh: 65 }, // both in prose
        { name: 'Invented', pLow: 12, pHigh: 34 }, // neither in prose
      ],
    };
    const out = validateStruct(struct, GOOD_PROSE);
    expect(out.scenarios).toHaveLength(1);
    expect(out.scenarios[0].name).toBe('Holds');
  });

  it('drops scenarios with inverted or out-of-range probabilities', () => {
    const struct = {
      scenarios: [
        { name: 'Inverted', pLow: 80, pHigh: 20 },
        { name: 'OutOfRange', pLow: -5, pHigh: 65 },
      ],
    };
    const out = validateStruct(struct, GOOD_PROSE);
    expect(out).toBeNull();
  });

  it('drops indicators missing a required field, keeps kills optional', () => {
    const struct = {
      indicators: [
        { signal: 'Talks resume', confirms: 'Holds' }, // no kills — fine, optional
        { signal: 'No confirms field' }, // missing confirms — dropped
        { confirms: 'Holds' }, // missing signal — dropped
      ],
    };
    const out = validateStruct(struct, GOOD_PROSE);
    expect(out.indicators).toHaveLength(1);
    expect(out.indicators[0].kills).toBe('');
  });

  it('drops ripples with a bad enum and keeps well-formed ones', () => {
    const struct = {
      ripples: [
        { instrument: 'Brent crude', direction: 'up', magnitude: 'moderate' },
        { instrument: 'Gold', direction: 'sideways', magnitude: 'moderate' }, // bad enum
        { instrument: 'Yen', direction: 'up', magnitude: 'huge' }, // bad enum
      ],
    };
    const out = validateStruct(struct, GOOD_PROSE);
    expect(out.ripples).toHaveLength(1);
    expect(out.ripples[0].instrument).toBe('Brent crude');
  });

  it('returns null when every section is emptied by sanitization', () => {
    const struct = { scenarios: [{ name: 'Invented', pLow: 12, pHigh: 34 }] };
    expect(validateStruct(struct, GOOD_PROSE)).toBeNull();
  });

  it('returns null for a null/non-object struct', () => {
    expect(validateStruct(null, GOOD_PROSE)).toBeNull();
    expect(validateStruct('not an object', GOOD_PROSE)).toBeNull();
  });

  it('sanitizes the good fixture block end-to-end via extractStruct', () => {
    const text = fenced(GOOD_PROSE, GOOD_BLOCK);
    const { struct, prose } = extractStruct(text);
    const out = validateStruct(struct, prose);
    expect(out.scenarios).toHaveLength(2);
    expect(out.indicators).toHaveLength(1);
    expect(out.ripples).toHaveLength(1);
  });
});
