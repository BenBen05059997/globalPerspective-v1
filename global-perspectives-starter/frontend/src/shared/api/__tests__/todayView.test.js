// The today view (decision 0051): the mappers answer what the five actions answered, on a live capture of 2026-10-31 09:47 UTC (fixtures:
// todayActions.json = the actions' answers, todayView.json = index/today.json built by newsStoryRecord from the same archive rows, the same
// `latest` item and the record's entry notes). Every difference is asserted here by name, so a new one fails the test.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import view from './fixtures/todayView.json';
import actions from './fixtures/todayActions.json';

const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/api/errorSink.js', () => sink);

import { topicsPayload, todayPayload, notePayload, loadTodayView, clearTodayViewCache, viewFirst } from '@/shared/api/todayView.js';

const NOW = Date.parse(actions.fetchedAt);
const clone = (x) => JSON.parse(JSON.stringify(x));
beforeEach(() => { clearTodayViewCache(); sink.reportFetchError.mockReset(); });

describe('topics', () => {
  const got = topicsPayload(view, NOW);
  const want = actions.topics;
  it('is the latest run: the same topics in the same order, field for field', () => {
    expect(got.data.topics.map((t) => t.id)).toEqual(want.data.topics.map((t) => t.id));
    for (const [i, t] of want.data.topics.entries()) expect(got.data.topics[i]).toEqual(t);
  });
  it('carries what only `latest` held (urgency, x_trending, primaryCountry) and the run\'s own fields', () => {
    expect(got.data.topics.every((t) => t.urgency && typeof t.x_trending === 'boolean' && t.primaryCountry)).toBe(true);
    const { topics: _a, ...gotRun } = got.data;
    const { topics: _b, ...wantRun } = want.data;
    expect(gotRun).toEqual({ ...wantRun, activatedAt: undefined, updatedAt: wantRun.updatedAt });
  });
  it('the envelope: success, cached, stale (older than the 9 h limit), asOf', () => {
    expect([got.success, got.cached, got.stale, got.asOf]).toEqual([want.success, want.cached, want.stale, want.asOf]);
    expect(topicsPayload(view, NOW + 10 * 3600000).stale).toBe(true);
  });
  it('is null when the view has no complete latest run (the page asks the action)', () => {
    expect(topicsPayload({ ...view, latest: null })).toBeNull();
    const gone = clone(view);
    gone.entries = gone.entries.filter((e) => e.topicId !== gone.latest.topicIds[0]);
    expect(topicsPayload(gone)).toBeNull();
    expect(topicsPayload(null)).toBeNull();
    expect(topicsPayload({ schemaVersion: 2, entries: [] })).toBeNull();
  });
});

describe('today', () => {
  const got = todayPayload(view, NOW);
  const want = actions.today;
  it('lists the entries of the last 24 hours as the today-archive item does: same order, same fields, three sources', () => {
    expect(got.data.entries.map((e) => e.topicId)).toEqual(want.data.entries.map((e) => e.topicId));
    for (const [i, e] of want.data.entries.entries()) expect({ ...got.data.entries[i], archivedAt: null }).toEqual({ ...e, archivedAt: null });
    expect(got.success).toBe(true);
  });
  it('the one difference: archivedAt. The agent stamps the today-archive copy and the daily-row copy of an entry with two clock reads, so the view\'s (the daily row\'s) is a few hundred milliseconds later', () => {
    for (const [i, e] of want.data.entries.entries()) {
      const d = Date.parse(got.data.entries[i].archivedAt) - Date.parse(e.archivedAt);
      expect(d, e.topicId).toBeGreaterThanOrEqual(0);
      expect(d, e.topicId).toBeLessThan(1000);
    }
  });
  it('updatedAt is the time of the newest write, to the millisecond', () => {
    expect(got.data.updatedAt).toBe(want.data.updatedAt);
  });
  it('cuts at read time: an entry over 24 h old at `now` is not listed', () => {
    const later = todayPayload(view, NOW + 20 * 3600000);
    expect(later.data.entries.length).toBeLessThan(got.data.entries.length);
    expect(later.data.entries.every((e) => Date.parse(e.archivedAt) > NOW + 20 * 3600000 - 86400000)).toBe(true);
  });
  it('nothing in the window: empty list and no updatedAt, as the action answers', () => {
    expect(todayPayload(view, NOW + 10 * 86400000)).toEqual({ success: true, data: { entries: [], updatedAt: null } });
  });
  it('carries nothing the action does not (no eventId, notes or latest fields)', () => {
    for (const e of got.data.entries) expect(Object.keys(e).filter((k) => ['eventId', 'notes', 'latest'].includes(k))).toEqual([]);
  });
});

describe('summary, prediction, trace_cause', () => {
  const kinds = ['summary', 'prediction', 'trace_cause'];
  const ids = actions.topics.data.topics.map((t) => t.id);
  // The one named difference: the action returns the text as stored; for json notes the record keeps the parsed object, so the mapper writes it
  // back with JSON.stringify (the same value, different whitespace). The pages parse it.
  const same = (a, b, json) => (json ? JSON.parse(a) : a);
  for (const kind of kinds) {
    it(`${kind}: the text, model, time and identity match the action for all ${ids.length} topics of the latest run (a kind the action has none of is null here too)`, () => {
      for (const id of ids) {
        const answer = actions.notes[kind][id];
        const got = notePayload(view, id, kind);
        if (!answer.success) { expect(got, `${id}: the action has no ${kind} either (cache miss)`).toBeNull(); continue; } // asked again, the action answers its cache miss as before
        const want = answer.data;
        expect(got, id).not.toBeNull();
        const json = want.contentFormat === 'json';
        expect(same(got.data.content, null, json)).toEqual(same(want.content, null, json));
        for (const k of ['model', 'generationId', 'action', 'generatedAt', 'topicId', 'threadId', 'title', 'contentFormat', 'kind']) expect(got.data[k], `${id} ${k}`).toEqual(want[k]);
        expect([got.success, got.cached, got.stale]).toEqual([true, true, false]);
      }
    });
  }
  it('what the action returns that the view does not (nothing the pages read): latencyMs, lastVerifiedAt, provider, sourceFingerprint, remainingTtlSeconds, promptVersion', () => {
    const want = actions.notes.prediction[ids[0]].data;
    const got = notePayload(view, ids[0], 'prediction').data;
    expect(want.promptVersion).toBe(3);
    expect(Object.keys(want).filter((k) => !(k in got)).sort()).toEqual(['lastVerifiedAt', 'latencyMs', 'promptVersion', 'provider', 'remainingTtlSeconds', 'sourceFingerprint']);
  });
  it('a topic outside the latest run, an unknown kind or a part with no note is null (the page asks the action)', () => {
    const earlier = view.entries.find((e) => !view.latest.topicIds.includes(e.topicId));
    expect(notePayload(view, earlier.topicId, 'summary')).toBeNull();
    expect(notePayload(view, ids[0], 'forecast')).toBeNull();
    expect(notePayload(view, 'nope', 'summary')).toBeNull();
    expect(notePayload({ ...view, latest: null }, ids[0], 'summary')).toBeNull();
  });
});

describe('membership', () => {
  it('the view holds only fields the anonymous actions return (no drift depth, corrections, member fields)', () => {
    const keys = new Set(view.entries.flatMap((e) => Object.keys(e)));
    for (const k of keys) expect(['topicId', 'threadId', 'title', 'category', 'regions', 'search_keywords', 'iso3', 'actors', 'event_type', 'continues_topic', 'sources', 'archivedAt', 'generationId', 'ai', 'eventId', 'latest', 'notes']).toContain(k);
    expect(Object.keys(view).sort()).toEqual(['builtFrom', 'entries', 'latest', 'schemaVersion', 'updatedAt']);
  });
});

describe('viewFirst and loadTodayView', () => {
  const fresh = (ok) => async () => ({ fresh: ok, manifest: null });
  it('answers from the view when the views are fresh and the view can answer; the action is not called', async () => {
    const action = vi.fn();
    const r = await viewFirst((v) => todayPayload(v, NOW), action, { fresh: fresh(true), load: async () => view });
    expect(r.data.entries.length).toBe(12);
    expect(action).not.toHaveBeenCalled();
  });
  it('asks the action when the views are not fresh, the view is missing, or the view cannot answer', async () => {
    for (const [ok, v, map] of [[false, view, (x) => todayPayload(x, NOW)], [true, null, (x) => todayPayload(x, NOW)], [true, view, () => null]]) {
      const action = vi.fn(async () => ({ from: 'action' }));
      expect(await viewFirst(map, action, { fresh: fresh(ok), load: async () => v })).toEqual({ from: 'action' });
      expect(action).toHaveBeenCalledTimes(1);
    }
  });
  it('a view that cannot be read is reported as today-view and answers null; one request serves every caller, a miss is not kept', async () => {
    const views = { fetchTodayView: vi.fn().mockRejectedValueOnce(new Error('record view 502 for index/today.json')).mockResolvedValue(clone(view)) };
    expect(await loadTodayView(views)).toBeNull();
    expect(sink.reportFetchError).toHaveBeenCalledWith('today-view', expect.any(Error));
    const [a, b] = await Promise.all([loadTodayView(views), loadTodayView(views)]);
    expect(a).toBe(b);
    expect(views.fetchTodayView).toHaveBeenCalledTimes(2);
  });
  it('a 404 (not generated yet) answers null without a report', async () => {
    expect(await loadTodayView({ fetchTodayView: async () => null })).toBeNull();
    expect(sink.reportFetchError).not.toHaveBeenCalled();
  });
});
