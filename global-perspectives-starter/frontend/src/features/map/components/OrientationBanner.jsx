// OrientationBanner — the Map's first lines (SPEC §2, decision 0064; design round 8): the promise sentence and, on desktop, the
// two kind chips on one line. On a phone it is the sentence only (the kinds are in Map key there), so the map fits the first
// screen. What the dots and the ◆ mean is in Map key and About this map. A slim, dismissible note, never a modal; the × is
// remembered per browser in localStorage, wrapped in try/catch so blocked storage still renders (it just re-shows next visit).
import { useState } from 'react';
import Button from '@/shared/ui/Button.jsx';
import ReaderPromise from '@/shared/ui/ReaderPromise.jsx';
import KindKey from '@/shared/ui/KindKey.jsx';

const DISMISSED_KEY = 'gp_map_orientation_dismissed_v2';

function readDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}

export default function OrientationBanner({ phone = false }) {
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
        {phone ? null : <KindKey oneLine />}
      </div>
      <Button variant="icon" className="sh-orient-close" onClick={dismiss} label="Dismiss this note">×</Button>
    </div>
  );
}
