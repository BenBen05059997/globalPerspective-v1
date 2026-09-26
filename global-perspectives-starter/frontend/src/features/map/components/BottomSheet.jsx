import { useEffect, useRef } from 'react';

// BottomSheet — M7 phone MAP tab: the selected situation/story's detail opens here instead of
// the desktop rail. Three stops (P1): peek (~120px, title + category only), half (~45vh), full
// (~85vh, role=dialog + aria-modal — the only stop that behaves as a true modal). A drag handle
// AND explicit buttons move between stops (44px targets); Esc always closes; focus moves into
// the sheet on open and returns to whatever had focus before it opened (WCAG 2.4.3).
// Reduced motion = instant cuts (no slide transition) — CLAUDE.md / the phone pattern brief.

const NEXT_UP = { peek: 'half', half: 'full', full: 'full' };
const NEXT_DOWN = { full: 'half', half: 'peek', peek: 'peek' };
const DRAG_THRESHOLD_PX = 36;

function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

export default function BottomSheet({ stop, onStopChange, onClose, title, subtitle, children }) {
  const sheetRef = useRef(null);
  const closeBtnRef = useRef(null);
  const restoreFocusEl = useRef(null);
  const dragRef = useRef(null);

  // Focus in on open, restore on close/unmount (the element that opened the sheet, e.g. a feed
  // row or a map pin) — never assumed, always whatever was actually focused.
  useEffect(() => {
    restoreFocusEl.current = document.activeElement;
    closeBtnRef.current?.focus?.();
    return () => {
      const prior = restoreFocusEl.current;
      if (prior && typeof prior.focus === 'function' && document.body.contains(prior)) {
        prior.focus();
      }
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const startDrag = (clientY) => { dragRef.current = { startY: clientY, stop }; };
  const endDrag = (clientY) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || clientY == null) return;
    const dy = clientY - d.startY;
    if (dy <= -DRAG_THRESHOLD_PX) onStopChange(NEXT_UP[d.stop]);
    else if (dy >= DRAG_THRESHOLD_PX) {
      if (d.stop === 'peek') onClose();
      else onStopChange(NEXT_DOWN[d.stop]);
    }
  };

  const onHandlePointerDown = (e) => { startDrag(e.clientY); e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onHandlePointerUp = (e) => endDrag(e.clientY);
  const onHandleKeyDown = (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); onStopChange(NEXT_UP[stop]); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); onStopChange(NEXT_DOWN[stop]); }
  };

  const isFull = stop === 'full';
  const reduced = prefersReducedMotion();

  return (
    <>
      {isFull ? <div className="sheet-scrim" onClick={onClose} aria-hidden="true" /> : null}
      <div
      ref={sheetRef}
      className={`sheet sheet-${stop}${reduced ? ' sheet-instant' : ''}`}
      role={isFull ? 'dialog' : undefined}
      aria-modal={isFull ? 'true' : undefined}
      aria-label={isFull ? (title || 'Details') : undefined}
    >
      <div
        className="sheet-handle-row"
        role="slider"
        tabIndex={0}
        aria-label="Sheet position"
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={stop === 'peek' ? 0 : stop === 'half' ? 1 : 2}
        aria-valuetext={stop}
        onPointerDown={onHandlePointerDown}
        onPointerUp={onHandlePointerUp}
        onKeyDown={onHandleKeyDown}
      >
        <span className="sheet-handle" aria-hidden="true" />
      </div>

      <div className="sheet-topbar">
        <div className="sheet-titlewrap">
          {subtitle ? <span className="sheet-subtitle">{subtitle}</span> : null}
          {title ? <span className="sheet-title">{title}</span> : null}
        </div>
        <div className="sheet-btns">
          {stop !== 'peek' ? (
            <button type="button" className="sheet-btn" onClick={() => onStopChange(NEXT_DOWN[stop])}>Collapse</button>
          ) : null}
          {stop !== 'full' ? (
            <button type="button" className="sheet-btn" onClick={() => onStopChange(NEXT_UP[stop])}>Expand</button>
          ) : null}
          <button type="button" ref={closeBtnRef} className="sheet-btn sheet-close" onClick={onClose} aria-label="Close">Close</button>
        </div>
      </div>

      {stop !== 'peek' ? <div className="sheet-body">{children}</div> : null}
      </div>
    </>
  );
}
