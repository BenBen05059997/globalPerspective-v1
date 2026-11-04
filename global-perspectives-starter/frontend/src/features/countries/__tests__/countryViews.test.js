import { describe, it, expect, vi } from 'vitest';
import { once } from '@/features/countries/lib/countryViews.js';

describe('once', () => {
  it('shares one run per key while it is in flight, then asks again', async () => {
    const inFlight = new Map();
    const run = vi.fn(() => new Promise((r) => setTimeout(() => r('view'), 5)));
    const [a, b] = await Promise.all([once(inFlight, 'countries/JPN.json', run), once(inFlight, 'countries/JPN.json', run)]);
    expect([a, b]).toEqual(['view', 'view']);
    expect(run).toHaveBeenCalledTimes(1);
    await once(inFlight, 'countries/JPN.json', run);
    expect(run).toHaveBeenCalledTimes(2);
    expect(inFlight.size).toBe(0);
  });

  it('a failed run is not kept', async () => {
    const inFlight = new Map();
    await expect(once(inFlight, 'k', () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(inFlight.size).toBe(0);
  });
});
