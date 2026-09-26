// OrientationBanner — H1 (REDESIGN_MASTER_PLAN.md §3.2): a slim, dismissible one-line
// orientation banner replaces the old guided-tour popover on the console. It never blocks
// navigation (it's a static line, not a modal/overlay) and is remembered per-browser via
// localStorage — wrapped in try/catch so a blocked/throwing storage still renders correctly
// (it just re-shows next visit instead of crashing).
import { useState } from 'react';

const DISMISSED_KEY = 'gp_map_orientation_dismissed_v1';

function readDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}

// Phones have no hover: say "tap" there (monitor fix, M7 review).
function canHover() {
  try { return !(window.matchMedia && window.matchMedia('(hover: none)').matches); } catch { return true; }
}

export default function OrientationBanner() {
  const [dismissed, setDismissed] = useState(readDismissed);
  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* storage blocked — just don't persist */ }
    setDismissed(true);
  };

  return (
    <div className="sh-orient" role="note">
      <span className="sh-orient-text">
        The map shows world events where they happen: pins are exact places, shaded countries are
        stories without an exact place. {canHover() ? 'Hover anything for a preview.' : 'Tap anything to open it.'}
      </span>
      <button className="sh-orient-close" onClick={dismiss} aria-label="Dismiss this note">×</button>
    </div>
  );
}
