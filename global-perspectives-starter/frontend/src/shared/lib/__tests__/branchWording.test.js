import { describe, it, expect } from 'vitest';
import { branchStatus, dayMonth, VOID_REASON_WORDS } from '../branchWording.js';

describe('branchStatus', () => {
  it('open branch shows its due date', () => {
    expect(branchStatus({ due: '2026-11-03', verdict: null })).toEqual({ kind: 'open', text: 'open · due 3 Nov', quote: null });
  });
  it('open branch without a usable due date says just open', () => {
    expect(branchStatus({ due: null, verdict: null }).text).toBe('open');
  });
  it('yes is "happened" with the evidence date and quote', () => {
    const s = branchStatus({ due: '2026-10-25', verdict: { at: '2026-10-26T06:00:00Z', result: 'yes', evidence: { eventId: 'e1', quote: ' Premiums rose. ', date: '2026-10-20' } } });
    expect(s).toEqual({ kind: 'happened', text: 'happened · 20 Oct', quote: 'Premiums rose.' });
  });
  it('yes without evidence quote or date falls back to the verdict date, no quote', () => {
    expect(branchStatus({ verdict: { at: '2026-10-22T06:00:00Z', result: 'yes', evidence: { url: 'https://e.test' } } })).toEqual({ kind: 'happened', text: 'happened · 22 Oct', quote: null });
    expect(branchStatus({ verdict: { at: '2026-10-20', result: 'yes', evidence: 'legacy string' } }).quote).toBeNull();
  });
  it('no is a claim about our coverage, never "did not happen"', () => {
    const s = branchStatus({ due: '2026-10-20', verdict: { at: '2026-10-21T09:00:00Z', result: 'no', evidence: null } });
    expect(s.text).toBe('not reported by 20 Oct');
    expect(s.text).not.toMatch(/did not|didn|fail|miss/i);
  });
  it('void gives the reason in words for every known reason', () => {
    for (const [reason, words] of Object.entries(VOID_REASON_WORDS)) {
      expect(branchStatus({ verdict: { at: '2026-10-21', result: 'void', voidReason: reason } }).text).toBe(`could not be checked · ${words}`);
    }
    expect(VOID_REASON_WORDS.ambiguous_criterion).toBe('the question was ambiguous');
    expect(VOID_REASON_WORDS.issued_before_method).toBe('recorded before scoring began');
  });
  it('void with an unknown or missing reason never invents one', () => {
    expect(branchStatus({ verdict: { at: '2026-10-21', result: 'void', voidReason: 'new_thing' } }).text).toBe('could not be checked');
    expect(branchStatus({ verdict: { at: '2026-10-21', result: 'void' } }).text).toBe('could not be checked');
  });
  it('a legacy branch with no verdict is recorded before scoring began', () => {
    expect(branchStatus({ legacy: true, due: '2026-10-20', verdict: null })).toEqual({ kind: 'legacy', text: 'recorded before scoring began', quote: null });
  });
  it('a legacy branch that has a verdict is worded by its verdict', () => {
    expect(branchStatus({ legacy: true, verdict: { at: '2026-10-20', result: 'void', voidReason: 'issued_before_method' } }).text).toBe('could not be checked · recorded before scoring began');
  });
});

describe('dayMonth', () => {
  it('reads the ISO string, not the local timezone', () => {
    expect(dayMonth('2026-10-20T23:59:59Z')).toBe('20 Oct');
    expect(dayMonth('2026-01-05')).toBe('5 Jan');
    expect(dayMonth(null)).toBe('');
    expect(dayMonth('garbage')).toBe('');
  });
});
