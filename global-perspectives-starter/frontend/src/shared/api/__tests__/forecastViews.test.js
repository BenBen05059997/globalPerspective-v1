import { describe, it, expect, vi } from 'vitest';

vi.mock('@/shared/api/errorSink.js', () => ({ reportFetchError: vi.fn() }));
const { recordForecast } = await import('@/shared/api/forecastViews.js');
const { reportFetchError } = await import('@/shared/api/errorSink.js');

const fork = (topic, day) => ({ forkId: `PRED#${topic}/${day}`, drawnAt: `${day}T05:00:00.000Z`, branches: [{ branchId: `PRED#${topic}/${day}/0-0`, text: 'Likely', p: 40, trigger: 't', resolutionSource: 'R', due: '2026-12-01', question: true, qid: 'q1', scenarioP: 60, scoring: 'sampled', state: 'awaiting' }] });
const fresh = (ok) => async () => ({ fresh: ok, manifest: null });
const views = (impl) => ({ fetchForecastsView: vi.fn(impl) });

describe('recordForecast', () => {
  it('maps the forecasts view to the snapshot while the views are fresh: by thread (every topic) or for the asked topics', async () => {
    const v = views(async () => ({ threadId: 'th', forks: [fork('A-1', '2026-10-20'), fork('B-2', '2026-10-22')] }));
    expect((await recordForecast('th', null, { fresh: fresh(true), getViews: v })).snapshot.topicId).toBe('B-2');
    expect((await recordForecast('th', ['A-1'], { fresh: fresh(true), getViews: v })).snapshot.topicId).toBe('A-1');
    expect(v.fetchForecastsView).toHaveBeenCalledWith('th');
  });

  it('a story with no file has drawn no question: answered, no snapshot, and the action is not needed', async () => {
    expect(await recordForecast('th', null, { fresh: fresh(true), getViews: views(async () => null) })).toEqual({ answered: true, snapshot: null });
  });

  it('stale views are not asked; no thread asks nothing', async () => {
    const v = views(async () => null);
    expect(await recordForecast('th', null, { fresh: fresh(false), getViews: v })).toEqual({ answered: false, snapshot: null });
    expect(await recordForecast('', null, { fresh: fresh(true), getViews: v })).toEqual({ answered: false, snapshot: null });
    expect(v.fetchForecastsView).not.toHaveBeenCalled();
  });

  it('a view that cannot be read is reported and the caller falls back to the action', async () => {
    const r = await recordForecast('th', null, { fresh: fresh(true), getViews: views(async () => { throw new Error('500'); }) });
    expect(r).toEqual({ answered: false, snapshot: null });
    expect(reportFetchError).toHaveBeenCalledWith('forecasts-view', expect.any(Error));
  });
});
