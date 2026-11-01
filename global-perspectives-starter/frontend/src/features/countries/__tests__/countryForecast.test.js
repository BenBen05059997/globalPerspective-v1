import { describe, it, expect, vi } from 'vitest';
import { countryForecast } from '@/features/countries/lib/countryForecast.js';

const snap = (topicId, at) => ({ topicId, generatedAt: `${at}T05:00:00.000Z`, scenarios: [] });
const threads = new Map([['A-1', 'th-a'], ['B-2', 'th-b'], ['B-3', 'th-b']]);

describe('countryForecast (the record only, decision 0052)', () => {
  it('asks the record once per story, for the topics it holds, and returns the newest forecast', async () => {
    const record = vi.fn(async (thread) => ({ answered: true, snapshot: thread === 'th-a' ? snap('A-1', '2026-10-20') : snap('B-3', '2026-10-25') }));
    const got = await countryForecast({ topicIds: ['A-1', 'B-2', 'B-3'], topicIdToThreadId: threads }, { recordForecast: record });
    expect(got.topicId).toBe('B-3');
    expect(record).toHaveBeenCalledWith('th-b', ['B-2', 'B-3']);
    expect(record).toHaveBeenCalledTimes(2);
  });

  it('stories with no forecast give null', async () => {
    const record = async () => ({ answered: true, snapshot: null });
    expect(await countryForecast({ topicIds: ['A-1'], topicIdToThreadId: threads }, { recordForecast: record })).toBeNull();
  });

  it('a story the record cannot answer adds nothing; the others still count', async () => {
    const record = async (thread) => (thread === 'th-a' ? { answered: false, snapshot: null } : { answered: true, snapshot: snap('B-2', '2026-10-25') });
    const got = await countryForecast({ topicIds: ['A-1', 'B-2'], topicIdToThreadId: threads }, { recordForecast: record });
    expect(got.topicId).toBe('B-2');
    expect(await countryForecast({ topicIds: ['A-1'], topicIdToThreadId: threads }, { recordForecast: record })).toBeNull();
  });

  it('topics with no thread are not asked for', async () => {
    const record = vi.fn();
    expect(await countryForecast({ topicIds: ['X-9'], topicIdToThreadId: threads }, { recordForecast: record })).toBeNull();
    expect(record).not.toHaveBeenCalled();
  });
});
