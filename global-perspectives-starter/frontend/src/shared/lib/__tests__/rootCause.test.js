import { describe, it, expect } from 'vitest';
import { rootCauseSteps, rootCauseText } from '../rootCause.js';

describe('rootCauseSteps', () => {
  it('turns a plain string into one unlabelled step', () => {
    expect(rootCauseSteps('  A because B.  ')).toEqual([{ key: 'text', label: null, text: 'A because B.' }]);
  });

  it('turns the three-layer object into labelled steps in causal order', () => {
    const steps = rootCauseSteps({ deeper_structural: 'S', proximate: 'P', medium_term: 'M' });
    expect(steps.map(s => [s.label, s.text])).toEqual([
      ['Trigger', 'P'], ['Enabling condition', 'M'], ['Structural factor', 'S'],
    ]);
  });

  it('accepts structural as an alias and skips empty layers', () => {
    expect(rootCauseSteps({ proximate: 'P', medium_term: ' ', structural: 'S' }).map(s => s.key))
      .toEqual(['proximate', 'deeper_structural']);
  });

  it('returns nothing for empty or unexpected values', () => {
    expect(rootCauseSteps(null)).toEqual([]);
    expect(rootCauseSteps('')).toEqual([]);
    expect(rootCauseSteps(42)).toEqual([]);
    expect(rootCauseSteps({ other: 'x' })).toEqual([]);
  });
});

describe('rootCauseText', () => {
  it('never produces [object Object]', () => {
    const text = rootCauseText({ proximate: 'P', medium_term: 'M', deeper_structural: 'S' });
    expect(text).toBe('Trigger: P\n\nEnabling condition: M\n\nStructural factor: S');
    expect(rootCauseText('plain')).toBe('plain');
  });
});
