import { describe, it, expect, vi } from 'vitest';
import { loadView, saveView, clean, VIEW_MAX, ROWS_MAX } from '@/features/countries/lib/countryYourView.js';

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m }; };

describe('your view', () => {
  it('clamps the view to 280 characters and the rows to 3', () => {
    const c = clean({ view: 'x'.repeat(400), rows: [1, 2, 3, 4, 5].map((i) => ({ ifText: `r${i}` })) });
    expect(c.view).toHaveLength(VIEW_MAX);
    expect(c.rows).toHaveLength(ROWS_MAX);
  });
  it('round-trips per country and removes the key when emptied', () => {
    const s = memory();
    saveView('Japan', { view: 'mine', rows: [{ ifText: 'rates move', by: '2026-11-01', source: 'BoJ', p: '0.3' }] }, s);
    expect(loadView('Japan', s)).toEqual({ view: 'mine', rows: [{ ifText: 'rates move', by: '2026-11-01', source: 'BoJ', p: '0.3' }] });
    expect(loadView('Iran', s)).toEqual({ view: '', rows: [] });
    saveView('Japan', { view: '', rows: [] }, s);
    expect(s.m.size).toBe(0);
  });
  it('survives blocked or corrupt storage', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(loadView('Japan', broken)).toEqual({ view: '', rows: [] });
    expect(saveView('Japan', { view: 'a', rows: [] }, broken)).toBe(false);
    expect(loadView('Japan', { getItem: () => '{not json' })).toEqual({ view: '', rows: [] });
  });
  it('makes no network call', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    saveView('Japan', { view: 'a', rows: [] }, memory());
    loadView('Japan', memory());
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
