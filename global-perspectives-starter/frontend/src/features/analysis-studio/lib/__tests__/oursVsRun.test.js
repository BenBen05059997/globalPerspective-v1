import { describe, it, expect } from 'vitest';
import { classifyPlaces, dropUnbackedPlaces } from '../oursVsRun.js';

describe('classifyPlaces', () => {
  it('splits places into ours (backed by a source region) and run-only', () => {
    const { ours, runOnly } = classifyPlaces(['Taiwan', 'South China Sea', 'Antarctica'], ['Taiwan', 'East Asia']);
    expect(ours).toEqual(['Taiwan']);
    expect(runOnly).toEqual(['South China Sea', 'Antarctica']);
  });

  it('is case/whitespace insensitive and dedupes', () => {
    const { ours, runOnly } = classifyPlaces(['  taiwan ', 'Taiwan', 'TAIWAN'], ['Taiwan']);
    expect(ours.length).toBe(1);
    expect(runOnly.length).toBe(0);
  });

  it('handles empty/missing input without throwing', () => {
    expect(classifyPlaces(null, null)).toEqual({ ours: [], runOnly: [] });
    expect(classifyPlaces([], [])).toEqual({ ours: [], runOnly: [] });
  });
});

describe('dropUnbackedPlaces', () => {
  it('drops a place not present in any source region and reports it', () => {
    const scenarios = [{ name: 'Escalation', pLow: 10, pHigh: 20, places: ['Taiwan', 'The Moon'] }];
    const { scenarios: out, dropped } = dropUnbackedPlaces(scenarios, ['Taiwan']);
    expect(out[0].places).toEqual(['Taiwan']);
    expect(dropped).toEqual([{ scenario: 'Escalation', place: 'The Moon' }]);
  });

  it('removes the places key entirely when nothing survives', () => {
    const scenarios = [{ name: 'X', pLow: 1, pHigh: 2, places: ['Nowhere'] }];
    const { scenarios: out } = dropUnbackedPlaces(scenarios, ['Taiwan']);
    expect(out[0].places).toBeUndefined();
  });

  it('leaves scenarios with no places untouched', () => {
    const scenarios = [{ name: 'X', pLow: 1, pHigh: 2 }];
    const { scenarios: out, dropped } = dropUnbackedPlaces(scenarios, ['Taiwan']);
    expect(out).toEqual(scenarios);
    expect(dropped).toEqual([]);
  });
});
