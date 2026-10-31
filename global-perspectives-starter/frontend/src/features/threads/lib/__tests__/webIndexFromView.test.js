// webIndexFromView — the record's web view through the UNCHANGED readers gives what the `web_index` action gave.
// Fixture captured live on 2026-10-31 (curl, outside the tests): the action and the record's index/web.json (built locally
// from a copy of the live record), both cut to the webs of Japan, China, South Korea and France. Compared through the
// functions the readers run: mergeWebLinks (Stories web), deriveFromIndex (story card, arcs), topicFromWebIndex (map deep
// link), connectionRows and whatWeDontKnow (country page), buildLinkArcs.
import { describe, it, expect } from 'vitest';
import { webIndexFromView, webViewUsable } from '@/features/threads/lib/webIndexFromView.js';
import { mergeWebLinks } from '@/features/threads/lib/storyWeb.js';
import { deriveFromIndex } from '@/features/threads/lib/webIndexLinks.js';
import { connectionRows } from '@/features/countries/lib/countryConnections.js';
import { webCountries } from '@/features/countries/lib/countryUnknowns.js';
import { topicFromWebIndex } from '@/features/map/lib/deepLinks.js';
import data from './fixtures/webIndexFromView.json';

const NOW = Date.parse(data.action.generatedAt) + 3600 * 1000;
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const rows = (a) => a.map((r) => JSON.stringify(sortKeys(r))).sort();
const action = data.action;
const index = webIndexFromView(data.view);
// the one pair whose second direction the record's link note does not carry (documented below)
const MISSING = ['thread-south-korea-test-flies-first-d-1811b9', 'thread-north-korea-rejects-south-s-ac-15dfe3'];
const touchesMissing = (id) => MISSING.includes(id);

describe('webIndexFromView against live captures', () => {
  it('maps the view to the action\'s keys and drops nothing the readers use', () => {
    expect(webViewUsable(data.view)).toBe(true);
    expect(Object.keys(index).sort()).toEqual(['generatedAt', 'links', 'maxAgeDays', 'shared', 'threads', 'websUsed']);
    expect(index.maxAgeDays).toBe(action.maxAgeDays);
    expect(rows(index.websUsed)).toEqual(rows(action.websUsed));
    // shared-actor links: actors, weight, country, generatedAt, iso3 all equal; only the a/b orientation of a pair is by id order here
    const pair = (r) => ({ ...r, a: [r.a, r.b].sort()[0], b: [r.a, r.b].sort()[1] });
    expect(rows(index.shared.map(pair))).toEqual(rows(action.shared.map(pair)));
  });

  it('links: the same judged links (every field), except the documented missing second direction', () => {
    const key = (l) => `${l.from}>${l.to}|${l.country}`;
    const live = new Map(action.links.map((l) => [key(l), l]));
    const view = new Map(index.links.map((l) => [key(l), l]));
    const missing = [...live.keys()].filter((k) => !view.has(k));
    expect(missing).toEqual([`${MISSING[0]}>${MISSING[1]}|South Korea`]);
    expect([...view.keys()].filter((k) => !live.has(k))).toEqual([]);
    for (const [k, l] of view) expect(JSON.stringify(sortKeys(l))).toBe(JSON.stringify(sortKeys(live.get(k))));
  });

  it('the Stories web merges the same edges and analyses (Japan, China, France webs: South Korea\'s edge pair differs by one direction)', () => {
    const live = mergeWebLinks(action, NOW);
    const view = mergeWebLinks(index, NOW);
    expect(view.analyses).toEqual(live.analyses);
    const edges = (m) => new Map(m.edges.map((e) => [e.key, e]));
    const l = edges(live); const v = edges(view);
    for (const [k, e] of v) expect(JSON.stringify(sortKeys(e))).toBe(JSON.stringify(sortKeys(l.get(k))));
    expect([...l.keys()].filter((k) => !v.has(k))).toEqual([`${MISSING[0]}->${MISSING[1]}`]);
  });

  it('every story: the same fed-into / fed-from / shared rows, state and provenance (untouched by the missing link)', () => {
    const ids = Object.keys(action.threads).filter((id) => !touchesMissing(id));
    expect(ids.length).toBeGreaterThan(10);
    const strip = (a, k) => a.map((r) => { const o = { ...r }; delete o[k]; return o; });
    let linked = 0;
    for (const id of ids) {
      const live = deriveFromIndex(action, id, NOW);
      const view = deriveFromIndex(index, id, NOW);
      expect(rows(strip(view.fedInto, 'targetTitle'))).toEqual(rows(strip(live.fedInto, 'targetTitle')));
      expect(rows(strip(view.fedFrom, 'sourceTitle'))).toEqual(rows(strip(live.fedFrom, 'sourceTitle')));
      expect(rows(strip(view.shared, 'otherTitle').map((r) => ({ ...r, actors: [...r.actors].sort(), webs: [...r.webs].sort((x, y) => x.country.localeCompare(y.country)) })))).toEqual(
        rows(strip(live.shared, 'otherTitle').map((r) => ({ ...r, actors: [...r.actors].sort(), webs: [...r.webs].sort((x, y) => x.country.localeCompare(y.country)) }))));
      expect(view.hiddenOlder).toBe(live.hiddenOlder);
      expect(view.state).toBe(live.state);
      expect(view.provenance && { ...view.provenance, countries: [...view.provenance.countries].sort() }).toEqual(live.provenance && { ...live.provenance, countries: [...live.provenance.countries].sort() });
      if (live.fedInto.length || live.fedFrom.length) linked += 1;
    }
    expect(linked).toBeGreaterThan(5);
  });

  it('the map and the country page read the same: the stories in the index, their countries, the webs\' countries and the connection rows', () => {
    expect(webCountries(index).sort()).toEqual(webCountries(action).sort());
    const inBoth = Object.keys(action.threads).filter((id) => index.threads[id]);
    expect(inBoth.length).toBe(Object.keys(action.threads).length);
    for (const id of inBoth) expect(topicFromWebIndex(index, id)?.threadId).toBe(topicFromWebIndex(action, id)?.threadId);
    const arcs = Object.keys(action.threads).filter((id) => !touchesMissing(id)).map((threadId) => ({ threadId, latestTitle: null }));
    const viewRows = connectionRows(index, arcs, { limit: 100, now: NOW });
    const liveRows = connectionRows(action, arcs, { limit: 100, now: NOW });
    const strip = (r) => r.map(({ fromTitle, toTitle, ...rest }) => rest);
    // the same (from, to) pairs with the same strength; a pair judged by two webs at the same strength shows the web that comes first in the
    // list, which the action orders by its own row order and the view by country code: each row shown is still one the action holds
    expect(viewRows.map((r) => `${r.fromId}>${r.toId}|${r.confidence}`).sort()).toEqual(liveRows.map((r) => `${r.fromId}>${r.toId}|${r.confidence}`).sort());
    const held = new Set(rows(action.links.map((l) => ({ fromId: l.from, toId: l.to, mechanism: l.mechanism, asOf: l.generatedAt, confidence: l.confidence }))));
    for (const r of strip(viewRows)) expect(held.has(JSON.stringify(sortKeys({ fromId: r.fromId, toId: r.toId, mechanism: r.mechanism, asOf: r.asOf, confidence: r.confidence })))).toBe(true);
    expect(strip(viewRows).filter((r) => strip(liveRows).some((x) => JSON.stringify(sortKeys(x)) === JSON.stringify(sortKeys(r)))).length).toBeGreaterThan(viewRows.length - 3);
  });

  it('documented differences: titles, entry counts and places follow the record\'s entries (a day behind the archive, repeats merged); newest-web time; no targets', () => {
    const differing = Object.keys(action.threads).filter((id) => JSON.stringify(sortKeys({ t: action.threads[id].title, e: action.threads[id].entries, p: action.threads[id].places })) !== JSON.stringify(sortKeys({ t: index.threads[id].title, e: index.threads[id].entries, p: index.threads[id].places })));
    expect(differing.length).toBeLessThan(Object.keys(action.threads).length);
    for (const id of Object.keys(action.threads)) expect(index.threads[id].state).toBe(action.threads[id].state);
    expect(Math.abs(Date.parse(index.generatedAt) - Date.parse(action.generatedAt))).toBeLessThan(60 * 1000);
    expect(index.targets).toBeUndefined();
    expect(action.targets.count).toBeGreaterThan(0);
  });

  it('a missing or malformed view maps to null (the caller then asks the action)', () => {
    for (const bad of [null, {}, { links: [] }, { links: [], shared: [], websUsed: [] }, { links: {}, shared: [], websUsed: [], threads: {} }]) {
      expect(webViewUsable(bad)).toBe(false);
      expect(webIndexFromView(bad)).toBeNull();
    }
  });
});
