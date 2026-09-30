import { describe, it, expect } from 'vitest';
import { deriveBootSensors, WAITING_SENSORS } from '@/features/map/lib/bootSensors.js';

const base = { topics: [], topicsSettled: false, topicsError: null, world: null, worldLoading: true, worldError: null, mapDrawn: false, mapFailed: false };
const st = (o) => Object.fromEntries(deriveBootSensors({ ...base, ...o }).map((s) => [s.id, s.state]));

describe('deriveBootSensors', () => {
  it('everything waits until something really arrives', () => {
    expect(st({})).toEqual({ news: 'wait', disaster: 'wait', map: 'wait' });
    expect(WAITING_SENSORS.every((s) => s.state === 'wait')).toBe(true);
  });
  it('news is ok only once the topics load has settled', () => {
    expect(st({ topics: [{ title: 'x' }] }).news).toBe('wait'); // cached rows on screen, live load unsettled
    expect(st({ topicsSettled: true, topics: [{ title: 'x' }] }).news).toBe('ok');
    expect(st({ topicsSettled: true }).news).toBe('ok');        // fetched, an empty list is a fact
  });
  it('news fails only when the load errored and there is nothing to show', () => {
    expect(st({ topicsSettled: true, topicsError: 'x' }).news).toBe('fail');
    expect(st({ topicsSettled: true, topicsError: 'x', topics: [{ title: 'cached' }] }).news).toBe('ok');
  });
  it('disaster alerts need the world bundle with a checked GDACS source', () => {
    expect(st({ world: { sources: { gdacs: '2026-10-01T00:00:00Z' } }, worldLoading: false }).disaster).toBe('ok');
    expect(st({ world: { sources: { news: 'x' } }, worldLoading: false }).disaster).toBe('fail');
    expect(st({ worldLoading: false, worldError: new Error('500') }).disaster).toBe('fail');
    expect(st({ worldLoading: false }).disaster).toBe('fail');   // 404: no bundle generated yet
    expect(st({ worldLoading: true }).disaster).toBe('wait');
  });
  it('map ticks only on a real first draw, fails only on a real draw error', () => {
    expect(st({ mapDrawn: true }).map).toBe('ok');
    expect(st({ mapFailed: true }).map).toBe('fail');
    expect(st({ mapDrawn: true, mapFailed: true }).map).toBe('ok');
  });
});
