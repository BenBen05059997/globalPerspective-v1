// composeTopicsLede: the deterministic "Today's lede". Every number is a real tally of the input and the
// headline is verbatim one of the topic titles; no topics -> empty (the band renders nothing).
import { describe, it, expect } from 'vitest';
import { composeTopicsLede } from '@/features/home/lib/composeTopicsLede';

const t = (over = {}) => ({ title: 'Story', ...over });

describe('composeTopicsLede', () => {
  it.each([undefined, {}, { topics: [] }, { topics: null }, { topics: [null, {}, { title: '' }] }])(
    'no usable topics (%j) -> empty, nothing invented',
    (input) => {
      const out = composeTopicsLede(input);
      expect(out).toMatchObject({ empty: true, lede: null, topicCount: 0, countryCount: 0, threadCount: 0 });
    },
  );

  it('urgent beats trending beats a larger source count', () => {
    const urgent = t({ title: 'Urgent', urgency: 'high' });
    const trending = t({ title: 'Trending', x_trending: true });
    const many = t({ title: 'Many sources', sources: Array.from({ length: 50 }, () => ({})) });
    expect(composeTopicsLede({ topics: [many, trending, urgent] }).lede).toMatchObject({ title: 'Urgent', reason: 'urgent' });
    expect(composeTopicsLede({ topics: [many, trending] }).lede).toMatchObject({ title: 'Trending', reason: 'trending' });
    expect(composeTopicsLede({ topics: [t({ title: 'Few', sources: [{}] }), many] }).lede)
      .toMatchObject({ title: 'Many sources', reason: '50 sources' });
  });

  it('a single source reads "1 source"; no signal gives a null reason; ties go to the earlier topic', () => {
    expect(composeTopicsLede({ topics: [t({ sources: [{}] })] }).lede.reason).toBe('1 source');
    expect(composeTopicsLede({ topics: [t()] }).lede.reason).toBeNull();
    const out = composeTopicsLede({ topics: [t({ title: 'First' }), t({ title: 'Second' })] });
    expect(out.lede.title).toBe('First');
  });

  it('counts distinct countries (trimmed) and distinct thread ids across all topics', () => {
    const out = composeTopicsLede({
      topics: [
        t({ title: 'A', threadId: 'th-1', regions: ['France', ' France ', 'Spain'] }),
        t({ title: 'B', threadId: 'th-1', regions: ['Spain'] }),
        t({ title: 'C', threadId: 'th-2' }),
        t({ title: 'D' }),
      ],
    });
    expect(out).toMatchObject({ empty: false, topicCount: 4, countryCount: 2, threadCount: 2 });
  });

  it('the lede carries the winner\'s thread, category and primary country (falling back to its first region)', () => {
    const a = composeTopicsLede({ topics: [t({ title: 'W', urgency: 'high', threadId: 'th-9', category: 'conflict', primaryCountry: 'Sudan', regions: ['Chad'] })] });
    expect(a.lede).toEqual({ title: 'W', threadId: 'th-9', category: 'conflict', country: 'Sudan', reason: 'urgent' });
    const b = composeTopicsLede({ topics: [t({ title: 'W', regions: ['Chad', 'Sudan'] })] });
    expect(b.lede).toMatchObject({ threadId: null, category: null, country: 'Chad' });
  });

  it('text pluralises stories / countries / threads and leaves out zero parts', () => {
    expect(composeTopicsLede({ topics: [t({ title: 'Solo' })] }).text).toBe("Today's lede: Solo. 1 story.");
    const many = composeTopicsLede({
      topics: [t({ title: 'A', regions: ['France'], threadId: 'x' }), t({ title: 'B', regions: ['Spain'], threadId: 'y' })],
    });
    expect(many.text).toBe("Today's lede: A. 2 stories, 2 countries, 2 active threads.");
    const one = composeTopicsLede({ topics: [t({ title: 'A', regions: ['France'], threadId: 'x' })] });
    expect(one.text).toBe("Today's lede: A. 1 story, 1 country, 1 active thread.");
  });
});
