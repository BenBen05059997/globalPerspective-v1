// layerMode — the R4b SITUATIONS / COUNTRY RISK map layer switch. Pure so the URL param, the
// localStorage read and the segmented control all agree on what a valid value looks like (same
// pattern as globeSpin.js's normalizeStoredView for the Globe/Radar switch).
export const LAYER_MODES = ['situations', 'risk'];
export const DEFAULT_LAYER = 'situations';

/** normalizeLayer(v) -> a valid layer mode, or null for anything else (caller falls back). */
export function normalizeLayer(v) {
  return LAYER_MODES.includes(v) ? v : null;
}
