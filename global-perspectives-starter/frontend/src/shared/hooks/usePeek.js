import { useCallback, useEffect, useRef, useState } from 'react';

const HOVER_DELAY_MS = 150;

/**
 * usePeek — shared open/close timing + edge-aware placement for StoryPeek (M5a). One hook, used
 * by every surface that names a story (feed rows, shaded countries, later: story mentions in
 * text). Does NOT fetch anything — callers already have the data; this only times the popover.
 *
 * Usage:
 *   const peek = usePeek();
 *   <button
 *     onMouseEnter={(e) => peek.openOnHover(id, e.currentTarget)}
 *     onMouseLeave={peek.close}
 *     onFocus={(e) => peek.openOnFocus(id, e.currentTarget)}
 *     onBlur={peek.close}
 *   >
 *   {peek.openId === id ? <StoryPeek ... style={peek.style} /> : null}
 *
 * Behaviour: hover opens after ~150ms (no flicker on a pass-through), keyboard focus opens
 * instantly, Esc/leave/blur close. Placement flips to whichever side keeps the peek inside the
 * viewport (falls back to below-right, clamped, if nothing fits — same technique as the map
 * callouts in SituationMap3D/RadarMap).
 */
export function usePeek({ delayMs = HOVER_DELAY_MS, peekWidth = 280, peekHeight = 140 } = {}) {
  const [openId, setOpenId] = useState(null);
  const [style, setStyle] = useState(null);
  const timerRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const placeFor = useCallback((anchorEl) => {
    if (!anchorEl || typeof anchorEl.getBoundingClientRect !== 'function') return null;
    const r = anchorEl.getBoundingClientRect();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const M = 8;
    const below = r.bottom + 6 + peekHeight <= vh;
    const above = r.top - 6 - peekHeight >= 0;
    const top = below ? r.bottom + 6 : (above ? r.top - 6 - peekHeight : Math.min(Math.max(r.top, M), vh - peekHeight - M));
    let left = r.left;
    if (left + peekWidth > vw - M) left = Math.max(M, vw - peekWidth - M);
    if (left < M) left = M;
    return { position: 'fixed', top, left, width: peekWidth };
  }, [peekHeight, peekWidth]);

  const openNow = useCallback((id, anchorEl) => {
    clearTimer();
    setOpenId(id);
    setStyle(placeFor(anchorEl));
  }, [placeFor]);

  const openOnHover = useCallback((id, anchorEl) => {
    clearTimer();
    timerRef.current = setTimeout(() => openNow(id, anchorEl), delayMs);
  }, [delayMs, openNow]);

  const openOnFocus = useCallback((id, anchorEl) => {
    openNow(id, anchorEl);
  }, [openNow]);

  const close = useCallback(() => {
    clearTimer();
    setOpenId(null);
    setStyle(null);
  }, []);

  useEffect(() => {
    if (!openId) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId, close]);

  useEffect(() => () => clearTimer(), []);

  return { openId, style, openOnHover, openOnFocus, close };
}

export default usePeek;
