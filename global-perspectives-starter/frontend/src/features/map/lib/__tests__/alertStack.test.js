// R4a · desktop alert stack (Console.dc.html): open situations, most severe → escalating → newest
// first; 30d+ ones hidden and counted; an honest, computed empty line.
import { describe, it, expect } from 'vitest';
import { alertStackItems, alertEmptyText, alertStackNote, ageShort } from '@/features/map/lib/alertStack.js';

const NOW = Date.parse('2026-09-27T12:00:00Z');
const hoursAgo = (h) => new Date(NOW - h * 3600e3).toISOString();
const S = (id, o) => ({ id, source: 'news', state: 'peak', centroid: { lat: 0, lon: 0 }, tier: 'low', last_change_at: hoursAgo(5), ...o });

describe('alertStackItems — ordering', () => {
  it('puts the most severe first, then escalating, then the newest activity', () => {
    const list = [
      S('low-new', { tier: 'low', last_change_at: hoursAgo(1) }),
      S('elev-old', { tier: 'elevated', last_change_at: hoursAgo(48) }),
      S('high-old', { tier: 'high', last_change_at: hoursAgo(72) }),
      S('elev-new', { tier: 'elevated', last_change_at: hoursAgo(2) }),
      S('elev-esc', { tier: 'elevated', escalating: true, last_change_at: hoursAgo(60) }),
    ];
    expect(alertStackItems(list, NOW).items.map((s) => s.id)).toEqual(['high-old', 'elev-esc', 'elev-new', 'elev-old', 'low-new']);
  });
  it('mixes GDACS alerts and news situations in one stack', () => {
    const { items } = alertStackItems([S('n', { tier: 'moderate' }), S('g', { source: 'gdacs', tier: 'elevated' })], NOW);
    expect(items.map((s) => s.id)).toEqual(['g', 'n']);
  });
  it('drops closed situations and ones with no map position', () => {
    const { items } = alertStackItems([S('closed', { state: 'closed' }), S('nowhere', { centroid: null }), S('ok')], NOW);
    expect(items.map((s) => s.id)).toEqual(['ok']);
  });
  it('hides situations not updated in 30+ days and counts them', () => {
    const { items, hiddenCount } = alertStackItems([S('stale', { last_change_at: hoursAgo(24 * 40) }), S('ok')], NOW);
    expect(items.map((s) => s.id)).toEqual(['ok']);
    expect(hiddenCount).toBe(1);
  });
  it('is safe on empty / bad input', () => {
    expect(alertStackItems(undefined, NOW)).toEqual({ items: [], hiddenCount: 0 });
    expect(alertStackItems([null, {}], NOW)).toEqual({ items: [], hiddenCount: 0 });
  });
});

describe('alert stack — honest empty state and notes', () => {
  it('says news is paused with the computed date when analysis is paused', () => {
    expect(alertEmptyText({ beyondLookback: false, label: 'Sep 12', text: 'analysis paused since Sep 12' }))
      .toBe('No disaster alerts open · news situations paused since Sep 12');
  });
  it('uses the beyond-lookback wording when no analysis was found at all', () => {
    expect(alertEmptyText({ beyondLookback: true, label: null, text: 'no analysis in the last 30 days' }))
      .toBe('No disaster alerts open · news situations paused — no analysis in the last 30 days');
  });
  it('states the plain fact when nothing is paused', () => {
    expect(alertEmptyText(null)).toBe('No disaster alerts or news situations open right now.');
  });
  it('adds a paused note only when a non-empty stack holds GDACS alerts alone', () => {
    const paused = { beyondLookback: false, label: 'Sep 12' };
    expect(alertStackNote([S('g', { source: 'gdacs' })], paused)).toBe('News situations paused since Sep 12');
    expect(alertStackNote([S('g', { source: 'gdacs' }), S('n')], paused)).toBeNull();
    expect(alertStackNote([], paused)).toBeNull();
    expect(alertStackNote([S('g', { source: 'gdacs' })], null)).toBeNull();
  });
  it('formats card ages from the last activity', () => {
    expect(ageShort(S('a', { last_change_at: hoursAgo(0.5) }), NOW)).toBe('30m');
    expect(ageShort(S('a', { last_change_at: hoursAgo(5) }), NOW)).toBe('5h');
    expect(ageShort(S('a', { last_change_at: hoursAgo(50) }), NOW)).toBe('2d');
    expect(ageShort({}, NOW)).toBe('');
  });
});
