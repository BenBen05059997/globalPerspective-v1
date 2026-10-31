import { describe, it, expect, vi } from 'vitest';
import { countryForecast } from '@/features/countries/lib/countryForecast.js';

const snap = (topicId, at) => ({ topicId, generatedAt: `${at}T05:00:00.000Z`, scenarios: [] });
const threads = new Map([['A-1', 'th-a'], ['B-2', 'th-b'], ['B-3', 'th-b']]);

describe('countryForecast', () => {
  it('asks the record once per story, for the topics it holds, and returns the newest forecast without calling the action', async () => {
    const record = vi.fn(async (thread) => ({ answered: true, snapshot: thread === 'th-a' ? snap('A-1', '2026-10-20') : snap('B-3', '2026-10-25') }));
    const fetchAction = vi.fn();
    const got = await countryForecast({ topicIds: ['A-1', 'B-2', 'B-3'], topicIdToThreadId: threads }, { recordForecast: record, fetchAction });
    expect(got.topicId).toBe('B-3');
    expect(record).toHaveBeenCalledWith('th-b', ['B-2', 'B-3']);
    expect(record).toHaveBeenCalledTimes(2);
    expect(fetchAction).not.toHaveBeenCalled();
  });

  it('stories with no forecast answered by the record give null, still without the action', async () => {
    const record = async () => ({ answered: true, snapshot: null });
    const fetchAction = vi.fn();
    expect(await countryForecast({ topicIds: ['A-1'], topicIdToThreadId: threads }, { recordForecast: record, fetchAction })).toBeNull();
    expect(fetchAction).not.toHaveBeenCalled();
  });

  it('one story the record cannot answer sends the whole list to the action, as before', async () => {
    const record = async (thread) => (thread === 'th-a' ? { answered: false, snapshot: null } : { answered: true, snapshot: snap('B-2', '2026-10-25') });
    const fetchAction = vi.fn(async () => ({ success: true, snapshot: snap('OLD-1', '2026-10-01') }));
    const got = await countryForecast({ topicIds: ['A-1', 'B-2'], topicIdToThreadId: threads }, { recordForecast: record, fetchAction });
    expect(got.topicId).toBe('OLD-1');
    expect(fetchAction).toHaveBeenCalledWith(['A-1', 'B-2']);
  });

  it('topics with no thread go to the action, and a failing action is empty', async () => {
    const record = vi.fn();
    expect(await countryForecast({ topicIds: ['X-9'], topicIdToThreadId: threads }, { recordForecast: record, fetchAction: async () => ({ success: false }) })).toBeNull();
    expect(record).not.toHaveBeenCalled();
  });
});
