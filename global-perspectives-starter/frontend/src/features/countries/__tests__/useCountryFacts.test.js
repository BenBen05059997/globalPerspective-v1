import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/shared/api/restProxy.js', () => ({ fetchCountryFacts: vi.fn() }));
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));

import { fetchCountryFacts } from '@/shared/api/restProxy.js';
import { reportFetchError } from '@/shared/api/errorSink';
import { useCountryFacts, _resetCountryFactsCache } from '@/features/countries/hooks/useCountryFacts.js';

describe('useCountryFacts', () => {
  beforeEach(() => { vi.resetAllMocks(); _resetCountryFactsCache(); });
  it('two mounts for the same country share one request; another country never shows the previous facts', async () => {
    fetchCountryFacts.mockResolvedValue({ data: { Japan: { capital: { names: ['Tokyo'] } } } });
    const a = renderHook(() => useCountryFacts('Japan'));
    const b = renderHook(() => useCountryFacts('Japan'));
    await waitFor(() => expect(a.result.current.facts).toBeTruthy());
    await waitFor(() => expect(b.result.current.facts).toBeTruthy());
    expect(fetchCountryFacts).toHaveBeenCalledTimes(1);
    const c = renderHook(({ n }) => useCountryFacts(n), { initialProps: { n: 'Japan' } });
    await waitFor(() => expect(c.result.current.facts).toBeTruthy());
    fetchCountryFacts.mockResolvedValue({ data: {} });
    c.rerender({ n: 'Peru' });
    expect(c.result.current.facts).toBeNull();
  });
  it('a failure is reported and leaves no facts', async () => {
    fetchCountryFacts.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useCountryFacts('Chad'));
    await waitFor(() => expect(reportFetchError).toHaveBeenCalledWith('country-facts', expect.any(Error)));
    expect(result.current.facts).toBeNull();
  });
});
