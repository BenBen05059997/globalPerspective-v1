import { describe, it, expect } from 'vitest';
import { buildReceipt } from '@/features/analysis-studio/lib/receipt';

describe('buildReceipt', () => {
  it('reports real provider usage, model, passed checks, sources, and time', () => {
    const r = buildReceipt({
      usage: { inputTokens: 1450, outputTokens: 380, model: 'gpt-5.6-2026-07-09' },
      model: 'gpt-5.6',
      checks: { hasError: false, warnings: [] },
      sourcesUsed: 4,
      elapsedMs: 3200,
      memberPath: false,
    });
    expect(r.hasError).toBe(false);
    expect(r.lines).toContain('Model: gpt-5.6');
    expect(r.lines).toContain('Tokens: 1450 in / 380 out (as reported by the provider).');
    expect(r.lines).toContain('Checks: passed.');
    expect(r.lines).toContain('Sources used: 4.');
    expect(r.lines).toContain('Run time: 3.2s.');
    expect(r.lines.join(' ')).not.toMatch(/still charged/);
  });

  it('on failed checks, says the provider still charged (BYOK only)', () => {
    const r = buildReceipt({
      usage: { inputTokens: 900, outputTokens: 210 },
      checks: { hasError: true, warnings: [{ code: 'phantom_citation', severity: 'error' }] },
      sourcesUsed: 1,
      memberPath: false,
    });
    expect(r.hasError).toBe(true);
    expect(r.lines.some((l) => l.startsWith('Checks: failed — phantom_citation'))).toBe(true);
    expect(r.lines).toContain('Your provider still charged for this run.');
  });

  it('the member path never claims usage it does not have, and is not billed as "charged"', () => {
    const r = buildReceipt({
      usage: null,
      checks: { hasError: true, warnings: [{ code: 'no_citations', severity: 'error' }] },
      sourcesUsed: 2,
      memberPath: true,
    });
    expect(r.lines).toContain('Included with your membership — no per-run provider usage to report.');
    expect(r.lines.join(' ')).not.toMatch(/still charged/);
  });

  it('honestly says when the provider reported no usage at all', () => {
    const r = buildReceipt({ usage: null, checks: null, sourcesUsed: 0, memberPath: false });
    expect(r.lines).toContain('Tokens: provider did not report usage for this run.');
  });
});
