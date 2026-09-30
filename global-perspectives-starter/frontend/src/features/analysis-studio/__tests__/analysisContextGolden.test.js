// The context a Studio run is built on must be the SAME whether the browser builds it (analysis.js wiring
// restProxy) or the share Lambda re-derives it (its own HTTP wiring). Both test against this one golden
// fixture (byte-identical copy in newsSharedAnalysis/test/fixtures, guarded by check-shared-sync.mjs).
import { describe, it, expect, vi } from 'vitest';
import golden from '@/features/analysis-studio/__tests__/fixtures/contextGolden.json';

vi.mock('@/shared/api/restProxy', () => {
  const p = golden.proxy;
  return {
    fetchSummaryCache: async (id) => p.summary[id],
    fetchPredictionCache: async (id) => p.prediction[id],
    fetchTraceCauseCache: async (id) => p.trace_cause[id],
    fetchNarrativeThread: async (id) => p.narrative_thread[id],
    fetchThreadAnalyses: async (ids) => p.thread_analysis[ids[0]],
    fetchPredictionSnapshot: async () => p.prediction_snapshot.any,
  };
});
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));

import { buildAnalysisContext } from '@/features/analysis-studio/lib/analysis.js';

describe('buildAnalysisContext (browser wiring)', () => {
  it('produces the golden context, citations and full numbered sources', async () => {
    const out = await buildAnalysisContext(golden.stories);
    expect(out.context).toBe(golden.expected.context);
    expect(out.citations).toEqual(golden.expected.citations);
    expect(out.sources).toEqual(golden.expected.sources);
    expect(out.thin).toBe(golden.expected.thin);
  });
  it('a re-dated repeat of a headline is dropped (only its earliest appearance is a source)', async () => {
    const out = await buildAnalysisContext(golden.stories);
    expect(out.context).not.toMatch(/re-dated repeat that must be dropped/);
  });
  it('source numbers are sequential across stories and match the citations', async () => {
    const out = await buildAnalysisContext(golden.stories);
    expect(out.sources.map((s) => s.n)).toEqual(out.citations.map((c) => c.n));
    expect(out.sources.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
