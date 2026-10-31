// linksFromView — the links view fed through the UNCHANGED deriveFromIndex gives what the web_index action gave.
// Fixtures captured live on 2026-10-31 (curl, outside the tests): the action's `web_index` (cut to the rows that touch
// the story) and the story's /data/record/views/links/<id>.json (its `links` shared-facts array emptied, unused here).
// `equal`: same rows, state, provenance, hidden count (row order among equal-confidence rows is not specified, so rows
// compare as sets) and the same titles. The other three are the documented, expected differences.
import { describe, it, expect } from 'vitest';
import { deriveFromIndex } from '@/features/threads/lib/webIndexLinks.js';
import { linkNote } from '@/features/threads/lib/linkStates.js';
import { indexFromView, viewHasLinks, needsTargets } from '@/features/threads/lib/linksFromView.js';
import data from './fixtures/linksFromView.json';

const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const rows = (a) => a.map((r) => JSON.stringify(sortKeys(r))).sort();
const shared = (a) => rows(a.map((r) => ({ ...r, actors: [...r.actors].sort(), webs: [...r.webs].sort((x, y) => x.country.localeCompare(y.country)) })));
const strip = (a, k) => a.map((r) => { const o = { ...r }; delete o[k]; return o; });
const core = (d) => ({ fedInto: rows(strip(d.fedInto, 'targetTitle')), fedFrom: rows(strip(d.fedFrom, 'sourceTitle')), shared: shared(strip(d.shared, 'otherTitle')), hiddenOlder: d.hiddenOlder, provenance: d.provenance, state: d.state });
const titles = (d) => [...d.fedInto.map((r) => r.targetTitle), ...d.fedFrom.map((r) => r.sourceTitle), ...d.shared.map((r) => r.otherTitle)].sort();
const NOW = data.now;
const both = (f) => ({ live: deriveFromIndex(f.index, f.threadId, NOW), view: deriveFromIndex(indexFromView(f.view, f.index.targets), f.threadId, NOW) });
const of = (kind) => data.fixtures.filter((f) => f.expect === kind);

describe('linksFromView against live captures', () => {
  it('captured at least 10 equal stories across every state, and 3 documented differences', () => {
    expect(of('equal').length).toBeGreaterThanOrEqual(10);
    expect(new Set(of('equal').map((f) => both(f).live.state))).toEqual(new Set(['linked', 'analysed_no_links', 'single_update', 'country_not_analysed']));
    expect(of('equal').some((f) => both(f).live.shared.length > 0)).toBe(true);
    expect(data.fixtures.length - of('equal').length).toBe(3);
  });

  for (const f of of('equal')) {
    it(`equal: ${f.threadId} (${f.note})`, () => {
      const { live, view } = both(f);
      expect(core(view)).toEqual(core(live));
      expect(titles(view)).toEqual(titles(live));
      expect(view.meta.state).toBe(live.meta.state);
      expect(view.meta.places[0]?.name).toBe(live.meta.places[0]?.name);
    });
  }

  it('equal stories: the empty-state note differs only by the "Last refresh" date', () => {
    for (const f of of('equal')) {
      const { live, view } = both(f);
      const ix = indexFromView(f.view, f.index.targets);
      const a = linkNote({ index: f.index, state: live.state, meta: live.meta, now: NOW });
      const b = linkNote({ index: ix, state: view.state, meta: view.meta, now: NOW });
      expect(b?.key).toBe(a?.key);
      expect(b?.lines.slice(0, -1)).toEqual(a?.lines.slice(0, -1));
    }
  });

  it('expected difference 1, titles and places: neighbours are titled from the record (newest entry), the top place is the record\'s', () => {
    const f = of('titles')[0];
    const { live, view } = both(f);
    expect(core(view)).toEqual(core(live));
    expect(titles(view)).not.toEqual(titles(live));
    expect(titles(view).every(Boolean)).toBe(true);
    expect(view.meta.places[0].name).not.toBe(live.meta.places[0].name);
  });

  it('expected difference 2, reverse direction: the live view predates the reverse-pair rows, so it lacks the second judged row', () => {
    const f = of('reverseDirection')[0];
    const { live, view } = both(f);
    const pairs = (d) => [...d.fedInto.map((r) => `${f.threadId}>${r.targetThreadId}`), ...d.fedFrom.map((r) => `${r.sourceThreadId}>${f.threadId}`)];
    const missing = pairs(live).filter((p) => !pairs(view).includes(p));
    expect(missing.length).toBeGreaterThan(0);
    // every missing row is the opposite direction of a pair the view does carry
    for (const p of missing) { const [a, b] = p.split('>'); expect(pairs(view)).toContain(`${b}>${a}`); }
    expect(view.state).toBe('linked');
  });

  it('expected difference 3, unknown state: a story the view calls unknown (no web, no entry in 14 days) the index called single_update', () => {
    const f = of('unknownState')[0];
    const { live, view } = both(f);
    expect(live.state).toBe('single_update');
    expect(view.state).toBeNull();
    expect(linkNote({ index: indexFromView(f.view), state: view.state, meta: view.meta, now: NOW }).key).toBe('unknown');
  });
});

describe('linksFromView rules', () => {
  const f = of('equal').find((x) => x.note.startsWith('country_not_analysed'));
  it('a view without `web` (or without judgedLinks) cannot answer', () => {
    expect(viewHasLinks(f.view)).toBe(true);
    expect(indexFromView({ ...f.view, web: undefined })).toBeNull();
    expect(indexFromView({ ...f.view, judgedLinks: undefined })).toBeNull();
    expect(indexFromView(null)).toBeNull();
  });
  it('generatedAt is the newest analysis the story sits in; none when it sits in no web', () => {
    const v = { threadId: 'a', judgedLinks: [], web: { state: 'linked', places: [], entries: 1, backbone: [], otherPlaces: {}, analysedIn: [{ country: 'X', generatedAt: '2026-10-01T05:00:00Z', nodes: 2 }, { country: 'Y', generatedAt: '2026-10-03T05:00:00Z', nodes: 3 }] } };
    expect(indexFromView(v).generatedAt).toBe('2026-10-03T05:00:00Z');
    expect(indexFromView({ ...v, web: { ...v.web, analysedIn: [] } }).generatedAt).toBeNull();
  });
  it('only country_not_analysed needs the run\'s country count (targets.count) from web_index', () => {
    expect(needsTargets(f.view)).toBe(true);
    expect(of('equal').filter((x) => needsTargets(x.view)).every((x) => both(x).live.state === 'country_not_analysed')).toBe(true);
    const withTargets = indexFromView(f.view, { count: 10 });
    const meta = deriveFromIndex(withTargets, f.threadId, NOW).meta;
    expect(linkNote({ index: withTargets, state: 'country_not_analysed', meta, now: NOW }).lines[0]).toMatch(/built for the 10 most-covered countries/);
    expect(linkNote({ index: indexFromView(f.view), state: 'country_not_analysed', meta, now: NOW }).lines[0]).toMatch(/built for the most-covered countries/);
  });
});
