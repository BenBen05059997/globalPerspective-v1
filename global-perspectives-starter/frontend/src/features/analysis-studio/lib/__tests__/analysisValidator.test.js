import { describe, it, expect } from 'vitest';
import { validateAnalysis, extractCitedNumbers, extractCitedWebNumbers } from '../analysisValidator.js';

const CITATIONS = [{ n: 1, title: 'Story A' }, { n: 2, title: 'Story B' }];
const CONTEXT = 'STORIES\n[1] Story A\nSummary: strikes resumed.\n[2] Story B\nSummary: talks reopened.';

describe('validateAnalysis — passing run', () => {
  it('passes clean, fully-cited output: ok, not hasError, shareable', () => {
    const text = '## Read\nThe strike in [1] raises risk, while talks in [2] cap the downside.';
    const res = validateAnalysis(text, { citations: CITATIONS, context: CONTEXT });
    expect(res.ok).toBe(true);
    expect(res.hasError).toBe(false);
    expect(res.shareable).toBe(true);
    expect(res.warnings).toEqual([]);
  });

  it('renders web + stored citations together without collision once webSources are pre-renumbered', () => {
    const text = '## Read\nOur story [1] is corroborated by new reporting [W1] and a second wire [W2].';
    const webSources = [
      { n: 1, title: 'Wire one', url: 'https://example.com/1' },
      { n: 2, title: 'Wire two', url: 'https://example.com/2' },
    ];
    const res = validateAnalysis(text, { citations: [{ n: 1, title: 'Story A' }], context: 'STORIES\n[1] Story A', webSources });
    expect(res.hasError).toBe(false);
    expect(extractCitedNumbers(text)).toEqual([1]);
    expect(extractCitedWebNumbers(text)).toEqual([1, 2]);
  });
});

describe('validateAnalysis — a citation to a missing source (phantom)', () => {
  it('flags an [n] beyond the provided stories as a hard error, hidden + not shareable', () => {
    const text = '## Read\nDrivers in [1] and [2] compound, and [3] confirms the trend across the region.';
    const res = validateAnalysis(text, { citations: CITATIONS, context: CONTEXT });
    expect(res.hasError).toBe(true);
    expect(res.shareable).toBe(false);
    expect(res.warnings.some((w) => w.code === 'phantom_citation' && w.severity === 'error')).toBe(true);
  });

  it('flags a [Wn] beyond the web sources actually returned', () => {
    const text = '## Read\nOur story [1] plus new reporting [W1] and a second wire [W2] that was never retrieved.';
    const webSources = [{ n: 1, title: 'Wire one', url: 'https://example.com/1' }];
    const res = validateAnalysis(text, { citations: [{ n: 1, title: 'Story A' }], webSources });
    expect(res.hasError).toBe(true);
    expect(res.shareable).toBe(false);
    expect(res.warnings.some((w) => w.code === 'phantom_web_citation')).toBe(true);
  });
});

describe('validateAnalysis — an uncited claim', () => {
  it('flags a long, substantive answer that cites nothing as a hard error', () => {
    const text =
      'The situation is broadly destabilising and the implications ripple across markets and ' +
      'alliances. Energy, shipping, and insurance all feel the strain, and the political class ' +
      'will respond with the usual mix of statements and quiet hedging over the coming weeks as ' +
      'the dust settles and the real costs become apparent to everyone involved in the region. ' +
      'Expect hedging in commodities, a firmer safe-haven bid, and a wider risk premium priced ' +
      'into the affected corridor until the political picture clarifies and confidence returns.';
    const res = validateAnalysis(text, { citations: [{ n: 1, title: 'Story A' }], context: 'STORIES\n[1] Story A' });
    expect(res.hasError).toBe(true);
    expect(res.shareable).toBe(false);
    expect(res.warnings.some((w) => w.code === 'no_citations' && w.severity === 'error')).toBe(true);
  });

  it('does not flag a short honest "Limits of this analysis" refusal', () => {
    const text = '## Limits of this analysis\nThe material is too thin to support a confident read here today.';
    const res = validateAnalysis(text, { citations: [{ n: 1, title: 'Story A' }], context: 'STORIES\n[1] Story A' });
    expect(res.hasError).toBe(false);
  });
});

describe('validateAnalysis — a structural / schema failure', () => {
  it('flags a required lens (Scenario/Economic) whose gp-struct block never validated', () => {
    const text = '## Read\nEscalation risk is elevated per [1]; a ceasefire looks roughly even odds.';
    const res = validateAnalysis(text, { citations: [{ n: 1, title: 'Story A' }], context: 'STORIES\n[1] Story A', requiresStruct: true, structOk: false });
    expect(res.hasError).toBe(true);
    expect(res.shareable).toBe(false);
    expect(res.warnings.some((w) => w.code === 'schema_invalid' && w.severity === 'error')).toBe(true);
  });

  it('does not flag when the struct came back valid', () => {
    const text = '## Read\nEscalation risk is elevated per [1]; a ceasefire looks roughly even odds.';
    const res = validateAnalysis(text, { citations: [{ n: 1, title: 'Story A' }], context: 'STORIES\n[1] Story A', requiresStruct: true, structOk: true });
    expect(res.hasError).toBe(false);
  });

  it('does not apply the schema check to lenses that never require one (default structOk=true)', () => {
    const text = '## Read\nCompares [1] and nothing else.';
    const res = validateAnalysis(text, { citations: [{ n: 1, title: 'Story A' }], context: 'STORIES\n[1] Story A' });
    expect(res.warnings.some((w) => w.code === 'schema_invalid')).toBe(false);
  });
});

// D2 (S5b): citations are no longer one-per-story — they're flat, typed, dated
// sources ({ n, kind, date, label, storyTitle, url }) numbered across the WHOLE
// selection. The validator only ever cares about `.length` (maxN) and doesn't
// interpret the shape further, so this must keep working unchanged.
describe('validateAnalysis — with typed, multi-source-per-story citations (D2)', () => {
  const TYPED_CITATIONS = [
    { n: 1, kind: 'ANALYSIS', date: '2026-09-22', label: 'Stored thread analysis', storyTitle: 'Germany AfD thread', url: null },
    { n: 2, kind: 'FORECAST', date: '2026-09-04', label: 'Forecast log', storyTitle: 'Germany AfD thread', url: null },
    { n: 3, kind: 'NEWS', date: '2026-09-10', label: 'cbc.ca', storyTitle: 'Philippines ferry fire', url: 'https://cbc.ca/x' },
  ];
  const TYPED_CONTEXT =
    'STORIES (typed, dated sources — cite by bracket number):\n\n' +
    'STORY: Germany AfD thread (Germany)\n[1] (ANALYSIS · 2026-09-22 — Stored thread analysis) Trajectory: coalition standoff likely.\n' +
    '[2] (FORECAST · 2026-09-04 — Forecast log) Most Likely (60%) — coalition talks fail by Oct 2026\n\n' +
    'STORY: Philippines ferry fire (Philippines)\n[3] (NEWS · 2026-09-10 — cbc.ca) Five dead, 86 missing.';

  it('passes when every typed source cited actually exists', () => {
    const text = '## Read\nThe AfD standoff [1] is likely to persist, with a coalition failure plausible by October [2]. Separately, the Palawan fire [3] remains under investigation.';
    const res = validateAnalysis(text, { citations: TYPED_CITATIONS, context: TYPED_CONTEXT });
    expect(res.hasError).toBe(false);
    expect(res.ok).toBe(true);
  });

  it('flags a phantom citation beyond the total typed-source count (not per-story)', () => {
    const text = '## Read\nThe standoff in [1] compounds with [4], which does not exist anywhere in the selection.';
    const res = validateAnalysis(text, { citations: TYPED_CITATIONS, context: TYPED_CONTEXT });
    expect(res.hasError).toBe(true);
    expect(res.warnings.some((w) => w.code === 'phantom_citation')).toBe(true);
  });

  it('flags unused sources across the whole numbering, not just within one story', () => {
    const text = '## Read\nOnly the forecast [2] is discussed here at any real length.';
    const res = validateAnalysis(text, { citations: TYPED_CITATIONS, context: TYPED_CONTEXT });
    const unused = res.warnings.find((w) => w.code === 'unused_source');
    expect(unused).toBeTruthy();
    expect(unused.message).toMatch(/\[1\].*\[3\]|\[3\].*\[1\]/);
  });
});
