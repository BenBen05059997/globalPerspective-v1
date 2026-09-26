import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePeek } from '@/shared/hooks/usePeek.js';

function fakeAnchor(rect = { top: 100, bottom: 120, left: 50, right: 150 }) {
  return { getBoundingClientRect: () => rect };
}

describe('usePeek', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts closed', () => {
    const { result } = renderHook(() => usePeek());
    expect(result.current.openId).toBeNull();
  });

  it('opens on hover only after the delay (no flicker on a quick pass-through)', () => {
    const { result } = renderHook(() => usePeek({ delayMs: 150 }));
    act(() => { result.current.openOnHover('s1', fakeAnchor()); });
    expect(result.current.openId).toBeNull();
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.openId).toBeNull();
    act(() => { vi.advanceTimersByTime(60); });
    expect(result.current.openId).toBe('s1');
  });

  it('cancels a pending hover-open if closed before the delay elapses', () => {
    const { result } = renderHook(() => usePeek({ delayMs: 150 }));
    act(() => { result.current.openOnHover('s1', fakeAnchor()); });
    act(() => { result.current.close(); });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.openId).toBeNull();
  });

  it('opens instantly on keyboard focus', () => {
    const { result } = renderHook(() => usePeek());
    act(() => { result.current.openOnFocus('s2', fakeAnchor()); });
    expect(result.current.openId).toBe('s2');
  });

  it('closes on Esc', () => {
    const { result } = renderHook(() => usePeek());
    act(() => { result.current.openOnFocus('s3', fakeAnchor()); });
    expect(result.current.openId).toBe('s3');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.openId).toBeNull();
  });

  it('close() clears the open id and style', () => {
    const { result } = renderHook(() => usePeek());
    act(() => { result.current.openOnFocus('s4', fakeAnchor()); });
    act(() => { result.current.close(); });
    expect(result.current.openId).toBeNull();
    expect(result.current.style).toBeNull();
  });

  it('computes a placement style anchored near the trigger element', () => {
    const { result } = renderHook(() => usePeek({ peekWidth: 280, peekHeight: 140 }));
    act(() => { result.current.openOnFocus('s5', fakeAnchor({ top: 100, bottom: 120, left: 50, right: 150 })); });
    expect(result.current.style).toBeTruthy();
    expect(typeof result.current.style.top).toBe('number');
    expect(typeof result.current.style.left).toBe('number');
  });
});
