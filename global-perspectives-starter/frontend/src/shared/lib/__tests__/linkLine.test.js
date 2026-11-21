import { describe, it, expect } from 'vitest';
import { pickLinkLine, signPlaces, pairPlaces } from '@/shared/lib/linkLine.js';

const judged = (o) => ({ from: 'a', to: 'x', otherTitle: 'X title', confidence: 'medium', generatedAt: '2026-11-20T00:00:00Z', lagDays: -3, ...o });
const view = (o = {}) => ({ threadId: 'a', links: [], confirmedLinks: [], judgedLinks: [], ...o });

const NONE = { mine: [], other: [], same: false };

describe('pickLinkLine', () => {
  it('no views, no links, or only a weak judged link: nothing', () => {
    expect(pickLinkLine(['a'], [null])).toBeNull();
    expect(pickLinkLine(['a'], [view()])).toBeNull();
    expect(pickLinkLine(['a'], [view({ judgedLinks: [judged({ confidence: 'weak' })] })])).toBeNull();
  });
  it('the strongest judged link of medium or strong strength, newest first on a tie; feeds into or fed by from the ids', () => {
    const v = view({ judgedLinks: [judged({ to: 'm', otherTitle: 'M' }), judged({ to: 's', otherTitle: 'S', confidence: 'strong' }), judged({ from: 'z', to: 'a', otherTitle: 'Z', confidence: 'strong', generatedAt: '2026-11-21T00:00:00Z' })] });
    expect(pickLinkLine(['a'], [v])).toEqual({ dir: 'fed', otherId: 'z', title: 'Z', strength: 'strong', confirmed: false, places: NONE });
    expect(pickLinkLine(['a'], [view({ judgedLinks: [judged()] })])).toEqual({ dir: 'feeds', otherId: 'x', title: 'X title', strength: 'medium', confirmed: false, places: NONE });
  });
  it('shared-name `links` never make a line', () => {
    expect(pickLinkLine(['a'], [view({ links: [{ otherThreadId: 'q', grounds: 3 }] })])).toBeNull();
  });
  it('a judged pair the weekly review also confirmed comes first (any direction value) and is marked confirmed', () => {
    const v = view({
      judgedLinks: [judged({ to: 's', confidence: 'strong', otherTitle: 'S' }), judged({ to: 'c', otherTitle: 'C', confidence: 'medium' })],
      confirmedLinks: [{ otherThreadId: 'c', direction: 'driven_by', week: '2026-W44', mechanism: 'm', cites: [] }],
    });
    expect(pickLinkLine(['a'], [v])).toEqual({ dir: 'feeds', otherId: 'c', title: 'C', strength: 'medium', confirmed: true, places: NONE });
  });
  it('the weekly review\'s direction never sets an arrow; confirmed links alone, or with only a weak judged link, make no line', () => {
    const c = [{ otherThreadId: 'c', direction: 'drives', week: '2026-W44', mechanism: 'm', cites: [] }];
    expect(pickLinkLine(['a'], [view({ confirmedLinks: c })])).toBeNull();
    expect(pickLinkLine(['a'], [view({ confirmedLinks: c, judgedLinks: [judged({ to: 'c', confidence: 'weak' })] })])).toBeNull();
  });
  it('reads both records of an alias: links on the alias target count for the story, and a link to its own alias is no link', () => {
    const own = view({ judgedLinks: [judged({ to: 'T' })] }); // the story to its own alias target
    const own2 = view({ judgedLinks: [judged({ to: 'egypt', otherTitle: 'Egypt' })] });
    const target = view({ threadId: 'T', confirmedLinks: [{ otherThreadId: 'egypt', direction: 'driven_by', week: '2026-W44', mechanism: 'm', cites: [] }], judgedLinks: [] });
    expect(pickLinkLine(['a', 'T'], [own2, target])).toEqual({ dir: 'feeds', otherId: 'egypt', title: 'Egypt', strength: 'medium', confirmed: true, places: NONE }); // judged on one record, confirmed on the other
    expect(pickLinkLine(['a', 'T'], [own])).toBeNull();
  });
});

const P = (...codes) => codes.map((c) => ({ iso3: c, name: c.toLowerCase() }));
describe('signPlaces', () => {
  it('this story\'s places, and the other story\'s places minus this story\'s', () => {
    expect(signPlaces(P('YEM', 'SAU'), P('EGY', 'SAU', 'YEM'))).toEqual({ mine: ['yem', 'sau'], other: ['egy'], same: false });
  });
  it('at most two each, in the given order; this story\'s full list still removes from the other', () => {
    expect(signPlaces(P('A', 'B', 'C'), P('C', 'D', 'E', 'F'))).toEqual({ mine: ['a', 'b'], other: ['d', 'e'], same: false });
  });
  it('every country of the other story is already this story\'s: "same places"', () => {
    expect(signPlaces(P('SAU', 'YEM'), P('YEM'))).toEqual({ mine: ['sau', 'yem'], other: [], same: true });
  });
  it('no countries in the data: no places and no "same places" claim; junk entries are dropped', () => {
    expect(signPlaces(undefined, undefined)).toEqual(NONE);
    expect(signPlaces(P('SAU'), [])).toEqual({ mine: ['sau'], other: [], same: false });
    expect(signPlaces([{ iso3: 'X' }, null], [{ name: 'n' }])).toEqual(NONE);
  });
  it('a judged link reads the places from its own view\'s web', () => {
    const v = view({ judgedLinks: [judged()], web: { places: P('YEM'), otherPlaces: { x: P('EGY', 'YEM') } } });
    expect(pickLinkLine(['a'], [v]).places).toEqual({ mine: ['yem'], other: ['egy'], same: false });
  });
  it('pairPlaces: the page rule for one pair, from the view holding the judged link (any strength, either direction, any of the ids)', () => {
    const alias = view({ threadId: 'al', judgedLinks: [judged({ from: 'al', to: 'x', confidence: 'weak' })], web: { places: P('YEM', 'SAU'), otherPlaces: { x: P('EGY', 'SAU') } } });
    const empty = view({ threadId: 'a', web: { state: 'empty', places: [], otherPlaces: {} } });
    expect(pairPlaces(['a', 'al'], [empty, alias], 'x')).toEqual({ mine: ['yem', 'sau'], other: ['egy'], same: false });
    expect(pairPlaces(['a', 'al'], [empty, alias], 'nobody')).toBeNull();
    expect(pairPlaces(['a'], [empty], 'x')).toBeNull();
  });
  it('the links of stories merged into this one count for it (its ids and views both)', () => {
    const merged = view({ threadId: 'm', judgedLinks: [judged({ from: 'm', to: 'x' })] });
    expect(pickLinkLine(['a', 'm'], [view(), merged]).otherId).toBe('x');
  });
});

describe('pairPlaces: the view must be the story\'s own', () => {
  it('the other end\'s view also names the pair but is not used for this story\'s places', () => {
    const own = { threadId: 'a', judgedLinks: [{ from: 'a', to: 'x', confidence: 'strong' }], web: { places: [{ iso3: 'IRN', name: 'Iran' }], otherPlaces: { x: [{ iso3: 'IRN', name: 'Iran' }] } } };
    const theirs = { threadId: 'x', judgedLinks: [{ from: 'a', to: 'x', confidence: 'strong' }], web: { places: [{ iso3: 'BHR', name: 'Bahrain' }], otherPlaces: {} } };
    expect(pairPlaces(['a'], [theirs, own], 'x')).toEqual({ mine: ['Iran'], other: [], same: true });
    expect(pairPlaces(['a'], [theirs], 'x')).toBeNull();
  });
});
