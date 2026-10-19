// check_color_literals — ratchet on hard-coded colours in the frontend source (engine: quality/ratchet.mjs).
//
// The site has ONE token set (shared/styles/tokens.css). A hard-coded colour in a component is a
// second palette, so per file and per kind the count may only go DOWN. Kinds:
//   hex        #rgb #rgba #rrggbb #rrggbbaa
//   func       rgb()/rgba()/hsl()/hsla()/hwb()/lab()/lch()/oklab()/oklch() (incl. template-built `rgba(${r},…)`)
//   named      CSS named colours: in CSS declaration values; in JS/JSX only as a colour-property value
//              (color/background/fill/stroke/border…: 'white', '1px solid red')
//   rgbArray   deck.gl-style [r, g, b] / [r, g, b, a] integer arrays (0-255, at least one value > 9)
//   hexNumber  0xrrggbb / 0xaarrggbb numbers
//   template   colours assembled from parts: `#${…}` or '#' + …
//   tokenCopy  a hex / rgb() / [r,g,b] whose value equals a tokens.css colour token (use var(--token)
//              or the tokens.js mirror instead). A subset of the kinds above, ratcheted separately.
// Excluded: tests, and the token files themselves (tokens.css, tokens.js), where colour values live.
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, stripCssComments, measure as measureWith, compare, run, isMain } from './ratchet.mjs';

export { compare };

const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-z_-])/gi;
const FUNC = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi;
const RGB_FUNC = /\brgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:[\s,/]+(\d*\.?\d+)(%?))?\s*\)/gi;
const ARRAY = /\[\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\]/g;
const HEX_NUMBER = /\b0x(?:[0-9a-f]{8}|[0-9a-f]{6})\b/gi;
const TEMPLATE = /`#\$\{|(['"])#\1\s*\+/g;
const NAMES = 'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen';
const NAMED = new RegExp(`(?<![\\w.#-])(?:${NAMES.split(' ').join('|')})(?![\\w-])`, 'gi');
const CSS_VALUE = /(?<![\w-])[a-z-]+\s*:\s*([^;{}]+)/gi;
const JS_COLOUR_VALUE = /\b(?:color|background(?:Color)?|fill|stroke|stopColor|outline(?:Color)?|border(?:Top|Right|Bottom|Left)?(?:Color)?|boxShadow|textShadow)\s*[:=]\s*\{?\s*(['"`])([^'"`\n]*)\1/g;

// Canonical 'r,g,b,a' for a colour literal (alpha 0-1, 2 decimals), or null.
const canon = (r, g, b, a = 1) => `${+r},${+g},${+b},${Math.round(a * 100) / 100}`;
function hexCanon(hex) {
  let h = hex.slice(1).toLowerCase();
  if (h.length <= 4) h = [...h].map((c) => c + c).join('');
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return canon(n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1);
}
const funcCanon = (m) => canon(m[1], m[2], m[3], m[4] === undefined ? 1 : m[5] ? m[4] / 100 : +m[4]);
const arrayCanon = (m) => canon(m[1], m[2], m[3], m[4] === undefined ? 1 : m[4].includes('.') ? +m[4] : m[4] / 255);
const isRgbArray = (m) => [m[1], m[2], m[3], m[4] ?? '0'].every((v) => +v <= 255) && Math.max(+m[1], +m[2], +m[3]) > 9;

// The colour values defined in tokens.css (only plain hex / numeric rgb() values).
export function tokenColours(css) {
  const out = new Set();
  for (const [, value] of stripCssComments(css).matchAll(/--[\w-]+\s*:\s*([^;]+);/g)) {
    const v = value.trim();
    if (/^#[0-9a-f]+$/i.test(v)) out.add(hexCanon(v));
    else for (const m of v.matchAll(RGB_FUNC)) if (m[0] === v) out.add(funcCanon(m));
  }
  return out;
}

export function countColours(text, file = '', tokens = new Set()) {
  const css = file.endsWith('.css');
  const src = css ? stripCssComments(text) : text;
  const hex = src.match(HEX) || [];
  const arrays = css ? [] : [...src.matchAll(ARRAY)].filter(isRgbArray);
  let named = 0;
  if (css) for (const [, v] of src.matchAll(CSS_VALUE)) named += (v.match(NAMED) || []).length;
  else for (const [, , v] of src.matchAll(JS_COLOUR_VALUE)) named += (v.match(NAMED) || []).length;
  const values = [...hex.map(hexCanon), ...[...src.matchAll(RGB_FUNC)].map(funcCanon), ...arrays.map(arrayCanon)];
  return {
    hex: hex.length,
    func: (src.match(FUNC) || []).length,
    named,
    rgbArray: arrays.length,
    hexNumber: css ? 0 : (src.match(HEX_NUMBER) || []).length,
    template: css ? 0 : (src.match(TEMPLATE) || []).length,
    tokenCopy: values.filter((v) => tokens.has(v)).length,
  };
}

const SKIP_FILES = new Set(['tokens.css', 'tokens.js']);
const skip = (rel) => SKIP_FILES.has(path.basename(rel));

// The counter for a repo checkout: reads that checkout's tokens.css for the token-copy kind.
export function colourCounter(root) {
  const tokens = tokenColours(fs.readFileSync(path.join(root, 'global-perspectives-starter/frontend/src/shared/styles/tokens.css'), 'utf8'));
  return (text, file) => countColours(text, file, tokens);
}

export const measure = (root) => measureWith(root, colourCounter(root), skip);

if (isMain(import.meta.url)) {
  process.exitCode = run({
    name: 'color_literals',
    title: 'colour literals',
    count: colourCounter(repoRoot),
    skip,
    note: 'Per-file, per-kind count of hard-coded colours in frontend src (see quality/check_color_literals.mjs). Counts may only fall; lower them with --lower after removing literals.',
    advice: 'use a token from shared/styles/tokens.css, or the tokens.js mirror in JS',
  });
}
