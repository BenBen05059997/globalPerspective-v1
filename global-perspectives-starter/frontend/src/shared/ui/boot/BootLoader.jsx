import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './BootLoader.css';
import './BootLoaderInline.css';
import { removeStaticBoot, bootWaitedMs } from './staticBoot.js';

// BootLoader — the shared "Option B" loading screen: a wireframe globe with a rotating radar
// sweep, and (optionally) a SENSOR STATUS list. The class names and DOM match the static copy
// injected by index.html, so the pre-JS boot hands off to this without a visible change.
//
// Honesty rules (product rules, not style):
//   - Sensor state comes ONLY from the `sensors` prop. This component never advances a state on a
//     timer and never shows a percentage. The one timer is the "slow network" note, which says
//     nothing about progress.
//   - A failed sensor is reported plainly (which one, and which are fine) with a real RETRY.
//
// Props:
//   sensors     [{ id, label, state: 'wait' | 'ok' | 'fail' }] — omit for the compact mark + sweep.
//   tone        ignored: the boot screen is dark on every page (one token set, 2026-10-01)
//   variant     'full' (fixed full-screen cover) | 'inline' (in flow, e.g. a Suspense fallback)
//   ready       true => fill the globe and crossfade away. Default: every sensor is 'ok'.
//   onDone      called once the crossfade finished (unmount the loader here).
//   onRetry     shows the RETRY button in the failure state.
//   onContinue  shows a second button (OPEN ANYWAY) so data that did load is never hidden behind
//               another sensor's failure.
//   text        one honest line under the mark, e.g. "Loading stories" (page loaders). No progress claims.
//   slowAfterMs delay before "Still connecting: slow network" (default 8000).

export const SWEEP_MS = 2600;
const STATE_TEXT = { wait: 'CONNECTING', ok: '✓ READY', fail: 'NOT LOADED' };

function joinNames(names) {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Honest one-liner worded from which sensors actually failed and which are fine. */
export function failureLine(sensors) {
  const failed = sensors.filter((s) => s.state === 'fail').map((s) => s.label);
  const ok = sensors.filter((s) => s.state === 'ok').map((s) => s.label);
  if (!failed.length) return '';
  let line = `${joinNames(failed)} didn't load.`;
  if (ok.length) line += ` ${joinNames(ok)} ${ok.length > 1 ? 'are' : 'is'} ready.`;
  return line;
}

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

function Globe() {
  // 200 x 200 viewBox: circle r=96, meridians rx 48/80, equator + prime meridian, parallels at
  // y=60/140 (chord half-width sqrt(96^2-40^2) = 87.3), a dashed inner ring.
  return (
    <svg className="gp-boot__svg" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle className="gp-boot__disc" cx="100" cy="100" r="96" />
      <g className="gp-boot__lines">
        <ellipse cx="100" cy="100" rx="48" ry="96" />
        <ellipse cx="100" cy="100" rx="80" ry="96" />
        <line x1="4" y1="100" x2="196" y2="100" />
        <line x1="100" y1="4" x2="100" y2="196" />
        <line x1="12.7" y1="60" x2="187.3" y2="60" />
        <line x1="12.7" y1="140" x2="187.3" y2="140" />
        <circle className="gp-boot__ring" cx="100" cy="100" r="72" />
      </g>
    </svg>
  );
}

export default function BootLoader({
  sensors = null, variant = 'full', ready, onDone, onRetry, onContinue,
  slowAfterMs = 8000, label = 'Loading Global Perspectives', text = null, className = '',
}) {
  const list = Array.isArray(sensors) ? sensors : [];
  const pending = list.length === 0 || list.some((s) => s.state === 'wait');
  const failedAny = list.some((s) => s.state === 'fail');
  const isReady = ready ?? (list.length > 0 && list.every((s) => s.state === 'ok'));
  const showFailure = !isReady && !pending && failedAny;

  const [slow, setSlow] = useState(false);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const retryRef = useRef(null);
  // The sweep's phase comes from the page clock, so the static index.html copy (same formula) and
  // this one are on the same angle at the moment of handoff.
  const [phase] = useState(() => -Math.round(performance.now() % SWEEP_MS));

  // First React commit: take the pre-JS boot node away (no-op when there isn't one). If the visitor
  // has already been watching the full boot since page load, the slow note counts from then.
  const waitedRef = useRef(0);
  useLayoutEffect(() => { removeStaticBoot(); waitedRef.current = bootWaitedMs(); }, []);

  // "Still connecting: slow network" — a note about elapsed time only; it never touches a sensor.
  useEffect(() => {
    if (!pending || isReady) return undefined;
    setSlow(false);
    const t = setTimeout(() => setSlow(true), Math.max(0, slowAfterMs - waitedRef.current));
    return () => clearTimeout(t);
  }, [pending, isReady, slowAfterMs]);

  // Reduced motion has no crossfade to wait for.
  useEffect(() => {
    if (isReady && prefersReducedMotion() && !doneRef.current) { doneRef.current = true; onDoneRef.current?.(); }
  }, [isReady]);

  useEffect(() => { if (showFailure) retryRef.current?.focus(); }, [showFailure]);

  const finish = (e) => {
    if (e.target !== e.currentTarget || e.propertyName !== 'opacity' || !isReady || doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current?.();
  };

  const cls = [
    'gp-boot', `gp-boot--${variant}`, 'gp-boot--dark', 'gp-console',
    isReady ? 'gp-boot--ready gp-boot--done' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} role="status" aria-label={label} onTransitionEnd={finish}>
      <div className="gp-boot__inner">
        <div className="gp-boot__globe">
          <Globe />
          <div className="gp-boot__sweep" style={{ animationDelay: `${phase}ms` }} />
        </div>
        <div className="gp-boot__panel">
          <div className="gp-boot__title">GLOBAL PERSPECTIVES</div>
          {text ? <p className="gp-boot__text">{text}</p> : null}
          {list.length ? (
            <>
              <div className="gp-boot__label">SENSOR STATUS</div>
              <ul className="gp-boot__sensors">
                {list.map((s) => (
                  <li key={s.id} className="gp-boot__row">
                    <span className="gp-boot__name">{s.label}</span>
                    <span className="gp-boot__st" data-state={s.state}>{STATE_TEXT[s.state] || STATE_TEXT.wait}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {showFailure ? <p className="gp-boot__note gp-boot__note--fail">{failureLine(list)}</p> : null}
          {slow && pending && !isReady ? <p className="gp-boot__note">Still connecting: slow network</p> : null}
          {showFailure && (onRetry || onContinue) ? (
            <div className="gp-boot__actions">
              {onRetry ? <button type="button" className="gp-boot__btn" ref={retryRef} onClick={onRetry}>RETRY</button> : null}
              {onContinue ? <button type="button" className="gp-boot__btn gp-boot__btn--quiet" onClick={onContinue}>OPEN ANYWAY</button> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
