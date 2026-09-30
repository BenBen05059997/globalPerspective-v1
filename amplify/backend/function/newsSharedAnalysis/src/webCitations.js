// imported by Node tooling outside src/ — keep relative imports
// Analysis Studio — web-source citation renumbering (D3, S5a).
//
// Bug (TRACK_RECORD_AND_STUDIO_RULING.md, critic 2): our own numbered stories are
// cited in the model's prose as [1], [2], … . A web-search provider (Perplexity's
// `sonar` models above all) ALSO writes its own [1], [2], … markers in the same
// prose, but those numbers index INTO THE PROVIDER'S OWN `search_results` list —
// they have nothing to do with our story numbering. Perplexity's API guarantees
// this correspondence natively: its bracket markers are always in the order its
// search results were returned, regardless of what our prompt asks it to number.
// Feeding that prose straight into `analysisValidator.js` made it read a
// Perplexity web citation as one of OUR story numbers — a deep run could falsely
// flag a citation as phantom, or silently misattribute a web claim to one of our
// stories.
//
// Fix: give web sources their OWN marker space, `[W1]`, `[W2]`, … , distinct from
// our `[n]` numbering, so the two can never collide:
//   - Well-behaved providers (prompted via DEEP_SYSTEM_PROMPT to use [Wn] directly)
//     need no rewriting — we just validate the marker range against what came back.
//   - Providers with NATIVE bracket numbering that ignores our format (Perplexity:
//     every [n] in the text is really its own web citation) get every such marker
//     rewritten to [Wn] before the prose ever reaches the story-citation validator.
//
// Pure + dependency-free (same reason as analysisValidator.js: importable from the
// offline eval harness under Node).

// Only http(s) links are ever rendered/linked — a provider could in principle
// return `javascript:`, `data:`, or other schemes in its citation metadata, and
// those must never become clickable.
function isHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

// renumberWebCitations(text, webSources, { nativeNumbering }) →
//   { text, webSources: [{ n, title, url }] }
//
//   - webSources: raw [{ title, url }] as returned by llm.js (already deduped by
//     provider, in the order the provider listed them). Non-http(s) entries are
//     dropped entirely (never numbered, never linked).
//   - nativeNumbering: true for providers whose bracket citations are natively the
//     provider's OWN indexing (Perplexity `sonar*`), unrelated to our [n] story
//     numbers. Every literal `[n]` for n in 1..K (K = number of web sources) is
//     rewritten to `[Wn]`. A placeholder swap avoids a partially-rewritten marker
//     re-matching a later replacement (e.g. rewriting [1] must not touch a [W1]
//     produced by rewriting a different, unrelated [1] elsewhere).
export function renumberWebCitations(text, webSources, { nativeNumbering = false } = {}) {
  const raw = typeof text === 'string' ? text : '';
  const numbered = (Array.isArray(webSources) ? webSources : [])
    .filter((w) => w && isHttpUrl(w.url))
    .map((w, i) => ({ n: i + 1, title: w.title || w.url, url: w.url }));

  if (!nativeNumbering || numbered.length === 0) {
    return { text: raw, webSources: numbered };
  }

  // A literal `[${n}]` (e.g. "[1]") can never appear as a substring of an already-
  // rewritten `[W${n}]` (e.g. "[W1]") — the character right after "[" differs ("W"
  // vs a digit) — so a plain split/join per number is safe regardless of order.
  let out = raw;
  for (const { n } of numbered) {
    out = out.split(`[${n}]`).join(`[W${n}]`);
  }
  return { text: out, webSources: numbered };
}

// extractCitedWebNumbers(text) → unique [Wn] numbers cited, in order seen.
export function extractCitedWebNumbers(text) {
  const out = [];
  const seen = new Set();
  const re = /\[W(\d{1,3})\]/g;
  let m;
  while ((m = re.exec(text || ''))) {
    const n = Number(m[1]);
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

// Build a marker→href lookup for Markdown's `links` prop, e.g. { W1: 'https://…' }.
export function webLinkMap(webSources) {
  const map = {};
  for (const w of webSources || []) {
    if (w && isHttpUrl(w.url)) map[`W${w.n}`] = w.url;
  }
  return map;
}
