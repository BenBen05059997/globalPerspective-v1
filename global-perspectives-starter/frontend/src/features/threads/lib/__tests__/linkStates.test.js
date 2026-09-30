import { describe, it, expect } from 'vitest';
import { linkNote } from '@/features/threads/lib/linkStates.js';

const NOW = Date.parse('2026-10-01T06:00:00Z');
const index = { generatedAt: '2026-09-30T05:00:00Z', targets: { count: 10 }, websUsed: [{ country: 'Iran', generatedAt: '2026-09-30T05:00:00Z', nodes: 4 }] };
const text = (n) => n.lines.join(' ');

describe('linkNote: the honest reason, from the index\'s own state', () => {
  it('linked: nothing to explain', () => {
    expect(linkNote({ index, state: 'linked', meta: {}, now: NOW })).toBeNull();
  });
  it('single update: one update so far, checked once it has two', () => {
    const t = text(linkNote({ index, state: 'single_update', meta: { entries: 1 }, now: NOW }));
    expect(t).toMatch(/^No linked stories found yet for this story\. It has one update so far; stories are checked for links once they have two or more\./);
    expect(t).toMatch(/Last refresh: Sep 30 2026\. A new link can only appear after the next one\./);
  });
  it('country not analysed: names the run\'s real country count and the story\'s country', () => {
    const t = text(linkNote({ index, state: 'country_not_analysed', meta: { places: [{ name: 'Peru', n: 3 }] }, now: NOW }));
    expect(t).toMatch(/built for the 10 most-covered countries in each run; Peru was not among them last time/);
  });
  it('analysed, no links: the date, the country and the number of other stories in that web', () => {
    const t = text(linkNote({ index, state: 'analysed_no_links', meta: { analysedIn: [{ country: 'Iran', generatedAt: '2026-09-30T05:00:00Z' }] }, now: NOW }));
    expect(t).toMatch(/checked on Sep 30 2026 together with 3 other stories in Iran; none met our evidence bar \(a named mechanism and at least one cited news item\)/);
  });
  it('unknown story: says it has no recent updates, never blames a fault', () => {
    const t = text(linkNote({ index, state: null, meta: null, now: NOW }));
    expect(t).toMatch(/not part of the current link analysis/);
    expect(t).not.toMatch(/something went wrong|error/i);
  });
  it('no index yet: says links have not been built, no date', () => {
    const n = linkNote({ index: null, state: 'no_index', meta: null, now: NOW });
    expect(n.lines[0]).toBe('Story links have not been built yet.');
    expect(text(n)).not.toMatch(/\b20\d\d\b/);
  });
  it('a stale index adds "not refreshed since <date>" with the real date', () => {
    const t = text(linkNote({ index: { ...index, generatedAt: '2026-09-20T05:00:00Z' }, state: 'single_update', meta: {}, now: NOW }));
    expect(t).toMatch(/Story links have not been refreshed since Sep 20 2026\./);
    expect(text(linkNote({ index, state: 'single_update', meta: {}, now: NOW }))).not.toMatch(/have not been refreshed since/);
  });
});
