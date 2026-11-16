// accuracyLock — "Accuracy locked until 150 resolved". Below the
// threshold: no Brier, no skill, no STRONG/WEAK word — only "n resolved of 150 needed". `n` here
// must already be the POST-PILOT count (see pilotExclusion.js) — the pilot's 122 never count
// toward unlocking this.
export const ACCURACY_UNLOCK_AT = 150;

export function isAccuracyLocked(postPilotResolved) {
  return (Number(postPilotResolved) || 0) < ACCURACY_UNLOCK_AT;
}

export function accuracyProgress(postPilotResolved) {
  const n = Math.max(0, Number(postPilotResolved) || 0);
  const pct = Math.max(0, Math.min(100, Math.round((n / ACCURACY_UNLOCK_AT) * 100)));
  return { n, target: ACCURACY_UNLOCK_AT, pct, locked: n < ACCURACY_UNLOCK_AT };
}
