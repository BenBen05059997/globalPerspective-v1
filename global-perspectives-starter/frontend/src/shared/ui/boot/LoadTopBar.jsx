import { useEffect, useRef, useState } from 'react';
import './LoadTopBar.css';

// LoadTopBar — the thin token-coloured bar that shows REAL request activity (the old LoadingBar,
// moved into the shared loader module so there is one loader family, not two). Hooks announce
// requests with window events `gp-loading-start` / `gp-loading-end`; the bar is visible while at
// least one is in flight. It carries role="progressbar" without a value (indeterminate), and the
// fill is a looping sweep — it never claims a percentage.
export default function LoadTopBar() {
  const [busy, setBusy] = useState(false);
  const countRef = useRef(0);
  const hideRef = useRef(null);

  useEffect(() => {
    const onStart = () => { countRef.current += 1; clearTimeout(hideRef.current); setBusy(true); };
    const onEnd = () => {
      countRef.current = Math.max(0, countRef.current - 1);
      if (countRef.current > 0) return;
      // brief hold so a very fast request doesn't flicker
      clearTimeout(hideRef.current);
      hideRef.current = setTimeout(() => setBusy(false), 250);
    };
    window.addEventListener('gp-loading-start', onStart);
    window.addEventListener('gp-loading-end', onEnd);
    return () => {
      window.removeEventListener('gp-loading-start', onStart);
      window.removeEventListener('gp-loading-end', onEnd);
      clearTimeout(hideRef.current);
    };
  }, []);

  if (!busy) return null;
  return (
    <div className="gp-topbar" role="progressbar" aria-label="Loading data" aria-busy="true">
      <div className="gp-topbar__fill" />
    </div>
  );
}
