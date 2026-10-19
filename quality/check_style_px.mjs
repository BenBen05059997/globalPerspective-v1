// check_style_px — ratchet on raw pixel sizes where tokens exist (engine: quality/ratchet.mjs).
//
// tokens.css has a type scale (--text-*), radii (--r-*) and spacing (--space-*). A raw px value in
// one of these properties is a size outside the system, so per file and per kind the count may only
// go DOWN. Every non-zero px number in the value counts (`padding: 4px 8px` = 2). Kinds:
//   fontSize  CSS font-size / font shorthand; JS fontSize (number or 'Npx'), font: '600 12px …'
//   radius    CSS border-radius / border-*-radius; JS borderRadius, border*Radius
//   spacing   CSS padding*, margin*, gap, row-gap, column-gap; JS padding*, margin*, gap, rowGap, columnGap
// JS forms counted: object keys (`fontSize: 12`), DOM assignment (`el.style.fontSize = '12px'`) and JSX
// attributes (`fontSize={12}`, `fontSize="12"`). A bare JS number counts as px (React's rule).
// Excluded: tests.
import { run, isMain, stripCssComments } from './ratchet.mjs';

const PX = /(?<![\w.-])\d*\.?\d+px\b/g;
const nonZeroPx = (v) => (v.match(PX) || []).filter((p) => parseFloat(p) !== 0).length;

const CSS_DECL = /(?<![\w-])(font-size|font|border(?:-[a-z]+)*-radius|padding(?:-[a-z]+)*|margin(?:-[a-z]+)*|gap|row-gap|column-gap)\s*:\s*([^;{}]*)/g;
const JS_VAL = String.raw`(-?\d*\.?\d+(?![\w.])|'[^'\n]*'|"[^"\n]*"|\`[^\`\n]*\`)`;
const JS_KEYS = String.raw`fontSize|font|borderRadius|border(?:Top|Bottom)(?:Left|Right)Radius|padding\w*|margin\w*|gap|rowGap|columnGap`;
const JS_DECL = new RegExp(String.raw`(?:\b(${JS_KEYS})\s*:\s*|\.(${JS_KEYS})\s*=\s*|\b(${JS_KEYS})=\{?\s*)${JS_VAL}`, 'g');

const kindOf = (prop) => (/^font/i.test(prop) ? 'fontSize' : /radius$/i.test(prop) ? 'radius' : 'spacing');

export function countPx(text, file = '') {
  const out = { fontSize: 0, radius: 0, spacing: 0 };
  if (file.endsWith('.css')) {
    for (const [, prop, value] of stripCssComments(text).matchAll(CSS_DECL)) out[kindOf(prop)] += nonZeroPx(value);
    return out;
  }
  for (const m of text.matchAll(JS_DECL)) {
    const prop = m[1] || m[2] || m[3];
    const value = m[4];
    const quoted = /^['"`]/.test(value);
    if (prop === 'font' && !quoted) continue; // `font` is only a size when it is a CSS font string
    // A JSX attribute string ("12") and a bare number are px; a quoted CSS value counts its px numbers.
    const n = !quoted ? (parseFloat(value) !== 0 ? 1 : 0)
      : m[3] && /^["']\d*\.?\d+["']$/.test(value) ? (parseFloat(value.slice(1)) !== 0 ? 1 : 0)
      : nonZeroPx(value);
    out[kindOf(prop)] += n;
  }
  return out;
}

if (isMain(import.meta.url)) {
  process.exitCode = run({
    name: 'style_px',
    title: 'raw px sizes',
    count: countPx,
    note: 'Per-file count of raw px in font-size / border-radius / spacing properties in frontend src (see quality/check_style_px.mjs). Counts may only fall; lower them with --lower after moving to tokens.',
    advice: 'use --text-*, --r-* or --space-* from shared/styles/tokens.css',
  });
}
