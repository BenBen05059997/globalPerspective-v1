import { useEffect, useRef, useState } from 'react';

// The globe's fly-to takes ~1.3 s. SituationMap3D forwards every camera frame of a running fly-to
// into its view-state ref (SituationMap3D.jsx onViewStateChange -> setViewState), and a frame that
// lands before React has committed a newer fly-to target overwrites that target with the old
// flight's in-between camera (no transition fields), so deck.gl drops the new flight and the globe
// stays on an earlier story. So the map is never handed a new focus while a flight it started is
// still running: the first change applies at once, later ones wait for the flight and only the
// latest value is applied.
export const FLIGHT_MS = 1500;

export function useSettledFocus(target, windowMs = FLIGHT_MS) {
  const [applied, setApplied] = useState(target);
  const lastApplied = useRef(0);
  useEffect(() => {
    if (target === applied) return undefined;
    const apply = () => { lastApplied.current = Date.now(); setApplied(target); };
    const wait = lastApplied.current + windowMs - Date.now();
    if (wait <= 0) { apply(); return undefined; }
    const id = setTimeout(apply, wait);
    return () => clearTimeout(id);
  }, [target, applied, windowMs]);
  return applied;
}
