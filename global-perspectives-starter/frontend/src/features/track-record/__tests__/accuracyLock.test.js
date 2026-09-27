import { describe, it, expect } from 'vitest';
import { isAccuracyLocked, accuracyProgress, ACCURACY_UNLOCK_AT } from '@/features/track-record/lib/accuracyLock.js';

describe('isAccuracyLocked', () => {
  it('is locked at 0', () => expect(isAccuracyLocked(0)).toBe(true));
  it('is locked just under the threshold', () => expect(isAccuracyLocked(ACCURACY_UNLOCK_AT - 1)).toBe(true));
  it('unlocks exactly at the threshold', () => expect(isAccuracyLocked(ACCURACY_UNLOCK_AT)).toBe(false));
  it('stays unlocked above it', () => expect(isAccuracyLocked(ACCURACY_UNLOCK_AT + 1)).toBe(false));
  it('is locked for the pilot count alone (122 < 150)', () => expect(isAccuracyLocked(122)).toBe(true));
});

describe('accuracyProgress', () => {
  it('reports n of target with a 0-100 percent', () => {
    expect(accuracyProgress(75)).toEqual({ n: 75, target: 150, pct: 50, locked: true });
  });
  it('clamps at 100% once past target', () => {
    expect(accuracyProgress(300).pct).toBe(100);
    expect(accuracyProgress(300).locked).toBe(false);
  });
  it('never goes negative for bad input', () => {
    expect(accuracyProgress(-5)).toEqual({ n: 0, target: 150, pct: 0, locked: true });
  });
});
