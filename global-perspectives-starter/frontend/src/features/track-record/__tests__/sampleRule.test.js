import { describe, it, expect } from 'vitest';
import { sha256Hex, drawFromPool, verifyDraw } from '@/features/track-record/lib/sampleRule.js';
import golden from '@/features/track-record/__tests__/fixtures/sampleRuleGolden.json';

describe('sampleRule (browser) matches the settle Lambda', () => {
  it('sha256 of a known string', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('the golden fixture (byte-identical copy of the Lambda\'s) gives the same picks, in the same order', async () => {
    const r = await drawFromPool(golden.seedHex, golden.pool, golden.K);
    expect(r.picked).toEqual(golden.picked);
    expect(r.eligible).toBe(golden.eligible);
    expect(r.clusters).toBe(golden.clusters);
    expect(await sha256Hex(golden.seedHex)).toBe(golden.commitHash);
  });
});

describe('verifyDraw', () => {
  const week = () => ({
    weekId: '2026-W41', weekStart: '2026-10-05',
    commit: { hash: golden.commitHash, committedAt: '2026-10-01T10:30:00Z' },
    reveal: { seedHex: golden.seedHex },
    draw: { K: golden.K, pool: golden.pool, picked: golden.picked },
  });
  it('a good draw verifies', async () => {
    const r = await verifyDraw(week());
    expect(r.ok).toBe(true);
    expect(r.picked).toBe(22);
  });
  it('fails on a wrong seed, a swapped pick, a late commitment, or missing parts', async () => {
    expect((await verifyDraw({ ...week(), reveal: { seedHex: 'aa'.repeat(32) } })).ok).toBe(false);
    const w = week(); [w.draw.picked[0], w.draw.picked[1]] = [w.draw.picked[1], w.draw.picked[0]];
    expect((await verifyDraw(w)).ok).toBe(false);
    expect((await verifyDraw({ ...week(), commit: { hash: golden.commitHash, committedAt: '2026-10-05T01:00:00Z' } })).ok).toBe(false);
    expect((await verifyDraw({ ...week(), draw: null })).problems.join(' ')).toMatch(/not published/);
    expect((await verifyDraw({ weekId: 'x', weekStart: '2026-10-05' })).ok).toBe(false);
  });
});
