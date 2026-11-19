// OrientationBanner — the Map's first line (SPEC §2, decision 0064): the promise sentence, the key to the two kind chips, and
// (where a map is on screen) one line on the dots. A slim, dismissible note, never a modal; the × is remembered per browser in
// localStorage, wrapped in try/catch so blocked storage still renders (it just re-shows next visit). The key moved to v2 when
// the sentence came in, so readers who closed the old line see the new one once.
import { useState } from 'react';
import Button from '@/shared/ui/Button.jsx';
import ReaderPromise from '@/shared/ui/ReaderPromise.jsx';
import KindKey from '@/shared/ui/KindKey.jsx';

const DISMISSED_KEY = 'gp_map_orientation_dismissed_v2';

function readDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}

// Phones have no hover: say "tap" there (monitor fix, M7 review).
function canHover() {
  try { return !(window.matchMedia && window.matchMedia('(hover: none)').matches); } catch { return true; }
}

export default function OrientationBanner({ withMap = true }) {
  const [dismissed, setDismissed] = useState(readDismissed);
  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* storage blocked — just don't persist */ }
    setDismissed(true);
  };

  return (
    <div className="sh-orient" role="note">
      <div className="sh-orient-text">
        <ReaderPromise className="sh-orient-promise" />
        <KindKey />
        {withMap ? (
          <p className="sh-orient-dots">
            On the map, each dot is a story; ◆ is an official disaster alert.{' '}
            {canHover() ? 'Hover anything for a preview; Map key explains the rest.' : 'Tap anything to open it; Map key explains the rest.'}
          </p>
        ) : null}
      </div>
      <Button variant="icon" className="sh-orient-close" onClick={dismiss} label="Dismiss this note">×</Button>
    </div>
  );
}
