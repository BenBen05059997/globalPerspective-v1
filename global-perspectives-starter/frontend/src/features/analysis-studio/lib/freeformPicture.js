// imported by Node tooling outside src/ — keep relative imports
// Free-form lens picture (S5c F1 §2): "clicking a sentence lights the sources it cites."
// Pure text split — splits the prose into sentence-ish units and maps each to the
// citation markers ([n] / [Wn]) it carries; the click/highlight behaviour itself lives
// in the component. Not a linguistic sentence splitter — good enough to group citations
// with the clause that carries them.

const CITE_RE = /\[(W?\d{1,3})\]/g;

// sentenceCitations(prose) -> [{ sentence, citations: string[] }]
//   citations are the raw marker bodies, e.g. "1", "W2" — the caller decides how to
//   resolve "1" against story citations and "W2" against web sources.
export function sentenceCitations(prose) {
  const text = typeof prose === 'string' ? prose : '';
  if (!text.trim()) return [];
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z#>\-*0-9])|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.map((sentence) => {
    const nums = [];
    const seen = new Set();
    const re = new RegExp(CITE_RE.source, 'g');
    let m;
    while ((m = re.exec(sentence))) {
      if (!seen.has(m[1])) { seen.add(m[1]); nums.push(m[1]); }
    }
    return { sentence, citations: nums };
  });
}
