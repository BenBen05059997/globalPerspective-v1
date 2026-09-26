// R4a · the approved map tokens (Legend.dc.html / STORY_WEB_RETHINK_PLAN.md §8) as pure helpers:
// shape = kind, size + double ring = HIGH only, brightness = freshness, ▲●◆▼ from tracker state.
import { describe, it, expect } from 'vitest';
import {
  tierSize, markerKind, markerShape, situationFreshness, freshnessClass, freshnessLook, statusGlyph,
  desaturateRgb, hexToRgb, markerHex,
} from '@/features/map/lib/legend.js';

const NOW = Date.parse('2026-09-27T12:00:00Z');
const hoursAgo = (h) => new Date(NOW - h * 3600e3).toISOString();

describe('legend — kind → shape', () => {
  it('GDACS situations are official alerts drawn as a diamond', () => {
    expect(markerKind({ source: 'gdacs' })).toBe('alert');
    expect(markerShape('alert')).toBe('diamond');
  });
  it('news situations are soft haloed dots (approximate place)', () => {
    expect(markerKind({ source: 'news' })).toBe('situation');
    expect(markerKind({})).toBe('situation');
    expect(markerShape('situation')).toBe('soft-dot');
  });
  it('stories with no exact place are a country wash; unknown kinds have no shape', () => {
    expect(markerShape('story')).toBe('country-wash');
    expect(markerShape('nope')).toBeNull();
    expect(markerKind(null)).toBeNull();
  });
});

describe('legend — tier → size / double ring', () => {
  it('uses four fixed steps that never shrink as the tier rises', () => {
    const r = ['low', 'moderate', 'elevated', 'high'].map((t) => tierSize(t).r);
    expect(r).toEqual([4, 6.5, 9, 9]);
  });
  it('reserves the double ring for HIGH only', () => {
    expect(tierSize('high')).toEqual({ r: 9, doubleRing: true, ringR: 14 });
    for (const t of ['low', 'moderate', 'elevated']) expect(tierSize(t).doubleRing).toBe(false);
  });
  it('treats an unknown tier as the smallest step, never as HIGH', () => {
    expect(tierSize('bogus')).toEqual({ r: 4, doubleRing: false, ringR: null });
  });
});

describe('legend — freshness → brightness', () => {
  it('maps age since the last change to live / plain / older / hidden', () => {
    expect(situationFreshness({ last_change_at: hoursAgo(3) }, NOW)).toBe('live');
    expect(situationFreshness({ last_change_at: hoursAgo(24 * 3) }, NOW)).toBe('plain');
    expect(situationFreshness({ last_change_at: hoursAgo(24 * 10) }, NOW)).toBe('older');
    expect(situationFreshness({ last_change_at: hoursAgo(24 * 31) }, NOW)).toBe('hidden');
  });
  it('falls back to opened_at, and never claims live or hidden without a timestamp', () => {
    expect(situationFreshness({ opened_at: hoursAgo(2) }, NOW)).toBe('live');
    expect(situationFreshness({}, NOW)).toBe('plain');
    expect(situationFreshness({ last_change_at: 'garbage' }, NOW)).toBe('plain');
  });
  it('clamps a slightly-future timestamp to live (clock skew), not hidden', () => {
    expect(situationFreshness({ last_change_at: hoursAgo(-0.1) }, NOW)).toBe('live');
  });
  it('gives each state its brightness class and look', () => {
    expect(freshnessClass('live')).toBe('mk-fresh-live');
    expect(freshnessClass('plain')).toBe('mk-fresh-plain');
    expect(freshnessClass('older')).toBe('mk-fresh-older');
    expect(freshnessClass('hidden')).toBe('mk-fresh-hidden');
    expect(freshnessLook('live')).toEqual({ visible: true, glow: true, desaturate: false, older: false });
    expect(freshnessLook('plain')).toEqual({ visible: true, glow: false, desaturate: false, older: false });
    expect(freshnessLook('older')).toEqual({ visible: true, glow: false, desaturate: true, older: true });
    expect(freshnessLook('hidden').visible).toBe(false);
  });
  it('desaturates the hue for "older" and leaves other states untouched', () => {
    expect(hexToRgb('#9b8cf8')).toEqual([155, 140, 248]);
    const faded = desaturateRgb([155, 140, 248]);
    expect(Math.max(...faded) - Math.min(...faded)).toBeLessThan(248 - 140);
    expect(markerHex('#9b8cf8', 'plain')).toBe('#9b8cf8');
    expect(markerHex('#9b8cf8', 'older')).not.toBe('#9b8cf8');
  });
});

describe('legend — status glyph from tracker fields', () => {
  it('▲ escalating from the escalating flag or state', () => {
    expect(statusGlyph({ state: 'peak', escalating: true }).glyph).toBe('▲');
    expect(statusGlyph({ state: 'escalating' }).key).toBe('escalating');
  });
  it('● new = emerging, ▼ cooling, ◆ steady = peak', () => {
    expect(statusGlyph({ state: 'emerging' }).glyph).toBe('●');
    expect(statusGlyph({ state: 'cooling' }).glyph).toBe('▼');
    expect(statusGlyph({ state: 'peak' }).glyph).toBe('◆');
  });
  it('escalating wins over the state word; closed/unknown get no badge', () => {
    expect(statusGlyph({ state: 'cooling', escalating: true }).glyph).toBe('▲');
    expect(statusGlyph({ state: 'closed', escalating: true })).toBeNull();
    expect(statusGlyph({ state: 'whatever' })).toBeNull();
    expect(statusGlyph(null)).toBeNull();
  });
});
