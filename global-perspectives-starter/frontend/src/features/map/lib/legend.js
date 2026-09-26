// legend — the approved default map tokens (STORY_WEB_RETHINK_PLAN.md §8, Legend.dc.html), as pure
// helpers so the globe (deck.gl), the radar (SVG), the Key panel and the alert cards all read the
// SAME channel rules and can never drift apart. Each visual channel means exactly one thing:
//
//   shape      = what it is   ◆ official GDACS alert · soft haloed dot = a situation at an
//                             approximate place · country wash = a story with no exact place ·
//                             HUD brackets = the selected item (an overlay, not a kind)
//   hue        = crisis type only (never severity, never GDACS's own traffic-light colour)
//   size       = severity: 4 fixed steps; a double ring is reserved for HIGH only
//   brightness = freshness: live <24h glow → 1–7d plain → 7–30d desaturated + "older" → 30d+
//                hidden from the map (and counted, never silently dropped)
//   badge      = direction: ▲ escalating · ● new · ◆ steady · ▼ cooling (text glyphs, so they
//                work without colour), derived only from the tracker's own `state`/`escalating`
//
// Motion is NOT decided here (lib/pulse.js owns the ≤8-pulse budget).
import { freshnessState } from '@/shared/lib/freshness.js';

export const TIERS = ['low', 'moderate', 'elevated', 'high'];

// Legend.dc.html §2 (USGS-style steps, not a smooth scale): LOW r4 · MODERATE r6.5 · ELEVATED r9 ·
// HIGH r9 + an outer ring at r14. The double ring — not a bigger dot — is what marks HIGH.
const TIER_SIZE = {
  low: { r: 4, ringR: null },
  moderate: { r: 6.5, ringR: null },
  elevated: { r: 9, ringR: null },
  high: { r: 9, ringR: 14 },
};

/** tierSize(tier) -> { r, doubleRing, ringR } — core radius (px) and the HIGH-only outer ring. */
export function tierSize(tier) {
  const t = TIER_SIZE[tier] || TIER_SIZE.low;
  return { r: t.r, doubleRing: t.ringR != null, ringR: t.ringR };
}

/**
 * markerKind(situation) -> 'alert' | 'situation' | null
 * 'alert' = an official GDACS alert (exact place from the feed); 'situation' = a news situation
 * placed at its main country's centroid (an approximate place). Stories with no situation are a
 * third kind ('story') that never reaches this helper — they only ever shade their country.
 */
export function markerKind(s) {
  if (!s) return null;
  return s.source === 'gdacs' ? 'alert' : 'situation';
}

const KIND_SHAPE = { alert: 'diamond', situation: 'soft-dot', story: 'country-wash' };
/** markerShape(kind) -> 'diamond' | 'soft-dot' | 'country-wash' | null */
export function markerShape(kind) {
  return KIND_SHAPE[kind] || null;
}

const KIND_LABEL = {
  alert: 'official disaster alert (GDACS)',
  situation: 'news situation, approximate place',
  story: 'story with no exact place',
};
export function kindLabel(kind) {
  return KIND_LABEL[kind] || '';
}

/**
 * situationFreshness(situation, now) -> 'live' | 'plain' | 'older' | 'hidden'
 * Age is measured from the situation's last change (else when it opened). A record carrying no
 * timestamp at all is shown 'plain' — never 'live' (we can't claim it's fresh) and never hidden
 * (we can't claim it's stale either).
 */
export function situationFreshness(s, now = Date.now()) {
  const iso = s?.last_change_at || s?.opened_at || null;
  if (!iso) return 'plain';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'plain';
  return freshnessState((now - t) / 86400000);
}

const FRESH_CLASS = { live: 'mk-fresh-live', plain: 'mk-fresh-plain', older: 'mk-fresh-older', hidden: 'mk-fresh-hidden' };
/** freshnessClass(state) -> the brightness class name for a freshness state. */
export function freshnessClass(state) {
  return FRESH_CLASS[state] || FRESH_CLASS.hidden;
}

/**
 * freshnessLook(state) -> { visible, glow, desaturate, older } — what each map renderer draws:
 * live glows; plain is full hue without glow; older is desaturated with an "older" label; hidden
 * is not drawn at all.
 */
export function freshnessLook(state) {
  switch (state) {
    case 'live': return { visible: true, glow: true, desaturate: false, older: false };
    case 'plain': return { visible: true, glow: false, desaturate: false, older: false };
    case 'older': return { visible: true, glow: false, desaturate: true, older: true };
    default: return { visible: false, glow: false, desaturate: false, older: false };
  }
}

const GLYPHS = {
  escalating: { glyph: '▲', key: 'escalating', label: 'escalating' },
  new: { glyph: '●', key: 'new', label: 'new' },
  steady: { glyph: '◆', key: 'steady', label: 'steady' },
  cooling: { glyph: '▼', key: 'cooling', label: 'cooling' },
};
export const STATUS_GLYPHS = GLYPHS;

/**
 * statusGlyph(situation) -> { glyph, key, label } | null
 * Read straight from the tracker's fields — nothing inferred:
 *   ▲ escalating  `escalating === true` or state 'escalating'
 *   ● new         state 'emerging'
 *   ▼ cooling     state 'cooling'
 *   ◆ steady      state 'peak' (the tracker's "ongoing")
 * A closed or unknown state gets no badge.
 */
export function statusGlyph(s) {
  if (!s || s.state === 'closed') return null;
  if (s.escalating === true || s.state === 'escalating') return GLYPHS.escalating;
  if (s.state === 'emerging') return GLYPHS.new;
  if (s.state === 'cooling') return GLYPHS.cooling;
  if (s.state === 'peak') return GLYPHS.steady;
  return null;
}

/** hexToRgb('#ee7754') -> [238, 119, 84]; null for anything unparseable. */
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * desaturateRgb(rgb, amount) — the "older" look: pull each channel toward the colour's own
 * luminance grey by `amount` (0 = unchanged, 1 = fully grey). Keeps the hue family readable
 * (Legend.dc.html shows #9b8cf8 → a greyed #8a84b8) while clearly reading as faded.
 */
export function desaturateRgb(rgb, amount = 0.6) {
  if (!Array.isArray(rgb) || rgb.length < 3) return rgb;
  const [r, g, b] = rgb;
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  return [r, g, b].map((c) => Math.round(c + (l - c) * amount));
}

export function rgbToHex(rgb) {
  return `#${rgb.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')}`;
}

/** markerHex(hex, freshState) — the hue to draw with, faded for the 'older' band. */
export function markerHex(hex, freshState) {
  if (freshState !== 'older') return hex;
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(desaturateRgb(rgb)) : hex;
}
