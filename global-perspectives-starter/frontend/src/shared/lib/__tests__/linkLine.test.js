import { describe, it, expect } from 'vitest';
import { pickLinkLine } from '@/shared/lib/linkLine.js';

const judged = (o) => ({ from: 'a', to: 'x', otherTitle: 'X title', confidence: 'medium', generatedAt: '2026-11-20T00:00:00Z', lagDays: -3, ...o });
const view = (o = {}) => ({ threadId: 'a', links: [], confirmedLinks: [], judgedLinks: [], ...o });

describe('pickLinkLine', () => {
  it('no views, no links, or only a weak judged link: nothing', () => {
    expect(pickLinkLine(['a'], [null])).toBeNull();
    expect(pickLinkLine(['a'], [view()])).toBeNull();
    expect(pickLinkLine(['a'], [view({ judgedLinks: [judged({ confidence: 'weak' })] })])).toBeNull();
  });
  it('the strongest judged link of medium or strong strength, newest first on a tie; feeds into or fed by from the ids', () => {
    const v = view({ judgedLinks: [judged({ to: 'm', otherTitle: 'M' }), judged({ to: 's', otherTitle: 'S', confidence: 'strong' }), judged({ from: 'z', to: 'a', otherTitle: 'Z', confidence: 'strong', generatedAt: '2026-11-21T00:00:00Z' })] });
    expect(pickLinkLine(['a'], [v])).toEqual({ dir: 'fed', otherId: 'z', title: 'Z', strength: 'strong', confirmed: false });
    expect(pickLinkLine(['a'], [view({ judgedLinks: [judged()] })])).toEqual({ dir: 'feeds', otherId: 'x', title: 'X title', strength: 'medium', confirmed: false });
  });
  it('shared-name `links` never make a line', () => {
    expect(pickLinkLine(['a'], [view({ links: [{ otherThreadId: 'q', grounds: 3 }] })])).toBeNull();
  });
  it('a judged pair the weekly review also confirmed comes first (any direction value) and is marked confirmed', () => {
    const v = view({
      judgedLinks: [judged({ to: 's', confidence: 'strong', otherTitle: 'S' }), judged({ to: 'c', otherTitle: 'C', confidence: 'medium' })],
      confirmedLinks: [{ otherThreadId: 'c', direction: 'driven_by', week: '2026-W44', mechanism: 'm', cites: [] }],
    });
    expect(pickLinkLine(['a'], [v])).toEqual({ dir: 'feeds', otherId: 'c', title: 'C', strength: 'medium', confirmed: true });
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
    expect(pickLinkLine(['a', 'T'], [own2, target])).toEqual({ dir: 'feeds', otherId: 'egypt', title: 'Egypt', strength: 'medium', confirmed: true }); // judged on one record, confirmed on the other
    expect(pickLinkLine(['a', 'T'], [own])).toBeNull();
  });
});
