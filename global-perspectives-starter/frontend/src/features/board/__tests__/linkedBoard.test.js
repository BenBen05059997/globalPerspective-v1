import { describe, it, expect } from 'vitest';
import {
  storyFacts, judgedLinks, sharedPairs, stripEvidence, linkOrder, cardLinks, linkCountText, whatMoved, movedSummary, markText,
  themeTitle, themeNewest, themesByNewest, presetLinks, judgedOn,
} from '@/features/board/lib/linkedBoard.js';

const st = (newest, born = '2026-10-01') => ({ newest: newest ? { date: newest, role: 'move' } : null, born });
const fmt = (d) => d;

describe('link order', () => {
  it('puts a story before every story it feeds, whatever their dates', () => {
    const stories = { a: st('2026-11-01'), b: st('2026-11-10'), c: st('2026-11-19') };
    const links = [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }];
    expect(linkOrder(['c', 'b', 'a'], links, stories)).toEqual({ linked: ['a', 'b', 'c'], alone: [] });
  });
  it('breaks ties by newest step, newest first, and a cycle at its newest story', () => {
    const stories = { a: st('2026-11-01'), b: st('2026-11-10'), c: st('2026-11-19'), d: st('2026-11-05') };
    expect(linkOrder(['a', 'b', 'c', 'd'], [{ from: 'a', to: 'd' }, { from: 'b', to: 'd' }], stories).linked).toEqual(['b', 'a', 'd']);
    const cycle = [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }];
    expect(linkOrder(['a', 'b', 'c'], cycle, stories).linked).toEqual(['c', 'a', 'b']);
  });
  it('returns the stories with no judged link apart, newest first', () => {
    const stories = { a: st('2026-11-01'), b: st('2026-11-10'), x: st('2026-11-02'), y: st('2026-11-12') };
    expect(linkOrder(['x', 'a', 'y', 'b'], [{ from: 'a', to: 'b' }], stories)).toEqual({ linked: ['a', 'b'], alone: ['y', 'x'] });
  });
});

describe('links on a card', () => {
  const links = judgedLinks([
    { from: 'a', to: 'b', strength: 'medium', reason: 'A moved B (E12).', judgedAt: '2026-11-18T05:00:00Z' },
    { from: 'b', to: 'c', strength: 'odd', reason: 'B moved C.' },
    { from: 'a', to: 'z', strength: 'weak' }, // z is not on the board
  ], ['a', 'b', 'c']);
  it('keeps only links between the board\'s stories, with a known strength or none', () => {
    expect(links.map((l) => `${l.from}>${l.to}:${l.strength}`)).toEqual(['a>b:medium', 'b>c:null']);
    expect(judgedOn(links)).toBe('2026-11-18');
  });
  it('a link is a feeds row on its from card and a fed-by row on its to card', () => {
    const b = cardLinks('b', links, []);
    expect(b.feeds.map((l) => l.to)).toEqual(['c']);
    expect(b.fedBy.map((l) => l.from)).toEqual(['a']);
    expect(linkCountText(b)).toBe('Feeds 1 · Fed by 1');
    expect(linkCountText(cardLinks('a', links, []))).toBe('Feeds 1');
    expect(linkCountText({ feeds: [], fedBy: [] })).toBe('');
  });
  it('strips evidence codes and nothing else', () => {
    expect(stripEvidence('The floods (E12) heightened scrutiny (E1, E3).')).toBe('The floods heightened scrutiny.');
  });
});

describe('shared names', () => {
  const links = [{ from: 'a', to: 'b' }];
  it('a note only for a pair with no judged link either way and at least two names; on both cards', () => {
    const pairs = sharedPairs([
      { a: 'b', b: 'a', actors: ['Iran', 'Oman'] }, // judged the other way: never a note
      { a: 'a', b: 'c', actors: ['Iran'] }, // one name: no note
      { a: 'c', b: 'b', actors: ['Oman'] }, { a: 'b', b: 'c', actors: ['Iran'] }, // two rows, two names: one note
    ], ['a', 'b', 'c'], links);
    expect(pairs).toEqual([{ a: 'b', b: 'c', names: ['Iran', 'Oman'] }]);
    expect(cardLinks('c', links, pairs).notes).toEqual([{ other: 'b', names: ['Iran', 'Oman'] }]);
    expect(cardLinks('b', links, pairs).notes).toEqual([{ other: 'c', names: ['Iran', 'Oman'] }]);
  });
});

describe('what moved', () => {
  const stories = { a: st('2026-11-19'), b: st('2026-11-12'), c: st('2026-11-18', '2026-11-17'), d: st(null) };
  it('a first visit counts this ISO week from Monday (UTC); a new story is "began", and ✦ wins over ●', () => {
    const m = whatMoved(['a', 'b', 'c', 'd'], stories, null, '2026-11-20');
    expect(m.mode).toBe('week');
    expect(m.from).toBe('2026-11-16');
    expect(m.stepped.map((r) => r.id)).toEqual(['a']);
    expect(m.joined.map((r) => r.id)).toEqual(['c']);
    expect(m.mark).toEqual({ a: 'stepped', c: 'joined' });
    expect(movedSummary(m, fmt)).toBe('This week: 1 story took a new step, 1 story began');
    expect(markText('joined', m.mode)).toBe('✦ Began this week');
    expect(markText('stepped', m.mode)).toBe('● New step this week');
  });
  it('a returning reader counts after the stored day; nothing new says so', () => {
    const m = whatMoved(['a', 'b', 'c'], stories, '2026-11-10', '2026-11-20');
    expect(m.mode).toBe('since');
    expect(m.stepped.map((r) => r.id)).toEqual(['a', 'b']);
    expect(movedSummary(m, fmt)).toBe('Since your last visit (2026-11-10): 2 stories took a new step, 1 story joined');
    expect(markText('joined', 'since')).toBe('✦ New since your visit');
    expect(movedSummary(whatMoved(['b'], stories, '2026-11-19', '2026-11-20'), fmt)).toBe('Since your last visit (2026-11-19): nothing new');
  });
  it('a stored value that is not a day counts as a first visit', () => {
    expect(whatMoved(['a'], stories, 'garbage', '2026-11-20').mode).toBe('week');
  });
});

describe('facts, titles and presets', () => {
  it('takes the step facts from the row first, then the story view; a missing fact is null', () => {
    expect(storyFacts('a', { title: 'Row', category: 'conflict', newestStep: { date: '2026-11-18T01:00:00Z', role: 'start' }, stepCount: 4 }, { title: 'View' }))
      .toMatchObject({ title: 'View', category: 'conflict', newest: { date: '2026-11-18', role: 'start' }, stepCount: 4 });
    expect(storyFacts('a', { title: 'Row' }, null)).toMatchObject({ title: 'Row', newest: null, stepCount: null, born: null, tier: null });
  });
  it('names a theme by its title countries', () => {
    const stories = [{}, {}, {}];
    expect(themeTitle({ stories, titleCountries: ['RUS', 'UKR'], moreCountries: 0 })).toBe('3 linked stories: Russia and Ukraine');
    expect(themeTitle({ stories, titleCountries: ['RUS', 'UKR'], moreCountries: 14 })).toBe('3 linked stories: Russia, Ukraine and 14 more countries');
  });
  it('orders themes by their newest step', () => {
    const t = (id, days) => ({ themeId: id, stories: days.map((d) => ({ newestStep: { date: d } })) });
    expect(themesByNewest([t('x', ['2026-11-01']), t('y', ['2026-11-02', '2026-10-01'])]).map((x) => x.themeId)).toEqual(['y', 'x']);
    expect(themeNewest({ stories: [{ lastEntryAt: '2026-11-03T10:00:00Z' }] })).toBe('2026-11-03');
  });
  it('maps a preset\'s pin-keyed links and shared pairs to story ids; a preset without links has null', () => {
    const pins = [{ pinId: 'p01', refId: 't-a' }, { pinId: 'p02', refId: 't-b' }];
    expect(presetLinks({ pins, links: [{ from: 'p02', to: 'p01', strength: 'weak' }], shared: [{ a: 'p01', b: 'p02', actors: ['X', 'Y'] }] }))
      .toEqual({ links: [{ from: 't-b', to: 't-a', strength: 'weak' }], shared: [{ a: 't-a', b: 't-b', actors: ['X', 'Y'] }] });
    expect(presetLinks({ pins }).links).toBeNull();
  });
});
