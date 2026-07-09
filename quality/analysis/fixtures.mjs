// Fixtures for the Analysis Studio eval (quality/analysis/run.mjs).
//
// Two kinds:
//   GOLDEN  — frozen (text, citations, context) cases with the EXACT warning codes
//             the validator must emit. These run with NO API key and are the
//             regression net for the guardrail checker itself.
//   LIVE    — story-sets (already-enriched topics) + lens/mode cases. These only run
//             when an API key is provided; the harness builds the real prompt, calls
//             the model, and validates what comes back.

// ── GOLDEN validator cases ───────────────────────────────────────────────────
// expect.codes is the SET of warning codes that must be present (order-free);
// expect.hasError is whether any error-severity warning must fire.
export const GOLDEN = [
  {
    name: 'clean_pass — both sources cited, no stray figures',
    text:
      '## Read\nThe escalation in [1] raises supply risk, while the talks in [2] cap the downside.\n\n' +
      '## So what\nWatch whether [2] holds; if it fails, [1] dominates the tape.',
    citations: [{ n: 1, title: 'A' }, { n: 2, title: 'B' }],
    context: 'STORIES\n[1] A\nSummary: tensions rose.\n[2] B\nSummary: talks resumed.',
    expect: { codes: [], hasError: false },
  },
  {
    name: 'phantom_citation — cites [3] when only 2 stories provided',
    text: '## Read\nDrivers in [1] and [2] compound, and [3] confirms the trend across the board here.',
    citations: [{ n: 1, title: 'A' }, { n: 2, title: 'B' }],
    context: 'STORIES\n[1] A\n[2] B',
    // [1] and [2] are both cited so nothing is unused; only the phantom [3] fires.
    expect: { codes: ['phantom_citation'], hasError: true },
  },
  {
    name: 'invented_figure — 30% appears nowhere in the material',
    text: '## Read\nEnergy exposure in [1] is the swing factor; prices could climb 30% on a supply shock.',
    citations: [{ n: 1, title: 'A' }],
    context: 'STORIES\n[1] A\nSummary: output fell about 12% after the strike.',
    expect: { codes: ['invented_figure'], hasError: false },
  },
  {
    name: 'threshold_criterion — ">50%" in an indicators-table row is a watch criterion, not a fact',
    text:
      '## Read\nEscalation risk is elevated per [1].\n\n' +
      '| Indicator to watch | Confirms | Kills |\n|---|---|---|\n' +
      '| Strait transits recover to >50% of pre-crisis levels | De-escalation | Tit-for-tat |',
    citations: [{ n: 1, title: 'A' }],
    context: 'STORIES\n[1] A\nSummary: strikes resumed and traffic plunged.',
    // The P1 indicators table produces comparison-operator thresholds (">50%"); the
    // analyst DEFINES these as criteria — they are not sourced-fact claims to flag.
    expect: { codes: [], hasError: false },
  },
  {
    name: 'no_citations — long answer anchoring nothing',
    text:
      'The situation is broadly destabilising and the implications ripple across markets and ' +
      'alliances. Energy, shipping, and insurance all feel the strain, and the political class ' +
      'will respond with the usual mix of statements and quiet hedging over the coming weeks as ' +
      'the dust settles and the real costs become apparent to everyone involved in the region. ' +
      'Expect hedging in commodities, a firmer safe-haven bid, and a wider risk premium priced ' +
      'into the affected corridor until the political picture clarifies and confidence returns.',
    citations: [{ n: 1, title: 'A' }],
    context: 'STORIES\n[1] A',
    expect: { codes: ['no_citations'], hasError: false },
  },
  {
    name: 'limits_ok — honest refusal is not penalised for missing citations',
    text:
      '## Limits of this analysis\nThe provided material is too thin to support a confident read. ' +
      'It notes the event but gives no figures, timeline, or counter-party detail, so any scenario ' +
      'forecast would be speculation rather than analysis grounded in the supplied stories here today.',
    citations: [{ n: 1, title: 'A' }],
    context: 'STORIES\n[1] A',
    expect: { codes: [], hasError: false },
  },
  {
    name: 'unused_source — [2] provided but never referenced',
    text: '## Read\nThe core driver sits entirely in [1]; it sets the direction for the week ahead.',
    citations: [{ n: 1, title: 'A' }, { n: 2, title: 'B' }],
    context: 'STORIES\n[1] A\n[2] B',
    expect: { codes: ['unused_source'], hasError: false },
  },
  {
    name: 'rounded_pct_accepted — "about 12%" of a sourced 12.3% is not a fabrication',
    // The model rounds 12.3% → "about 12%". "about" is an approximation cue, so this
    // is NOT flagged — rounding a real source figure is legitimate.
    text: '## Read\nOutput in [1] is down about 12% — a meaningful but not catastrophic hit.',
    citations: [{ n: 1, title: 'A' }],
    context: 'STORIES\n[1] A\nSummary: output fell 12.3% after the strike.',
    expect: { codes: [], hasError: false },
  },
  {
    name: 'scenario_probabilities_accepted — analyst probabilities are not "invented figures"',
    // The Scenario lens asks for "a rough probability" per scenario. Those % are
    // estimative judgment, not sourced facts, so they must NOT be flagged.
    text:
      '## Scenarios\n- Standoff persists (~60% probability): patrols continue, no shots [1].\n' +
      '- Limited incident (25% likelihood): a collision forces a climbdown [1].\n' +
      '- Framework holds (15%): talks in [2] produce a de-escalation deal.',
    citations: [{ n: 1, title: 'A' }, { n: 2, title: 'B' }],
    context: 'STORIES\n[1] A\nSummary: navies traded warnings.\n[2] B\nSummary: talks reopened.',
    expect: { codes: [], hasError: false },
  },
  {
    name: 'thin_input — coverage caveat surfaces when material was thin',
    text: '## Read\nThe core driver sits in [1]; little can be concluded from the limited material.',
    citations: [{ n: 1, title: 'A' }],
    context: 'STORIES\n[1] A',
    thinInput: true,
    expect: { codes: ['thin_input'], hasError: false },
  },
  {
    name: 'invented_date — a fabricated trigger date not in the material',
    text: '## Scenario\n- Escalation (~25%): a clash by June 15 breaks the talks [1].',
    citations: [{ n: 1, title: 'A' }],
    context: 'STORIES\n[1] A\nSummary: talks continue with no timeline given.',
    expect: { codes: ['invented_date'], hasError: false },
  },
  {
    name: 'date_in_context_ok — a date present in the material is not flagged',
    text: '## Scenario\n- The June 30 deadline [1] is the key trigger to watch.',
    citations: [{ n: 1, title: 'A' }],
    context: 'STORIES\n[1] A\nSummary: the parties set a June 30 deadline for the framework.',
    expect: { codes: [], hasError: false },
  },
  {
    name: 'relative_horizon_ok — "within weeks" is not a fabricated date',
    text: '## Scenario\n- A limited incident within weeks remains plausible; timing unclear [1].',
    citations: [{ n: 1, title: 'A' }],
    context: 'STORIES\n[1] A\nSummary: tensions persist.',
    expect: { codes: [], hasError: false },
  },
];

// ── assessRichness (thin-input detector) cases ───────────────────────────────
export const RICHNESS_CASES = [
  {
    name: 'rich set — substantive summaries',
    enriched: [
      { topic: { title: 'A' }, summary: 'x'.repeat(300), prediction: '', trace: '' },
      { topic: { title: 'B' }, summary: 'y'.repeat(50), prediction: '', trace: '' },
    ],
    expectThin: false, // the richest story clears the bar
  },
  {
    name: 'thin set — single bare-headline rumor',
    enriched: [
      { topic: { title: 'Unconfirmed reshuffle' }, summary: 'Unverified posts claim a removal.', prediction: '', trace: '' },
    ],
    expectThin: true,
  },
  {
    name: 'thin set — every story below the bar',
    enriched: [
      { topic: { title: 'A' }, summary: 'short', prediction: '', trace: '' },
      { topic: { title: 'B' }, summary: '', prediction: 'tiny', trace: '' },
    ],
    expectThin: true,
  },
  {
    name: 'rich via combined fields — summary+prediction+trace clear the bar',
    enriched: [
      { topic: { title: 'A' }, summary: 'a'.repeat(100), prediction: 'b'.repeat(80), trace: 'c'.repeat(80) },
    ],
    expectThin: false,
  },
];

// ── LIVE story-sets ──────────────────────────────────────────────────────────
// `enriched` matches what buildAnalysisContext() would return after fetching: an
// array of { topic:{title,category,regions,sources:[{url}]}, summary, prediction, trace }.
// These are realistic but fixed, so the eval is reproducible.
export const LIVE_FIXTURES = [
  {
    name: 'strait-tension + diplomacy (2 stories)',
    enriched: [
      {
        topic: {
          title: 'Naval standoff escalates in a contested strait',
          category: 'Conflict',
          regions: ['East Asia'],
          sources: [{ url: 'https://example.com/strait-1' }, { url: 'https://example.com/strait-2' }],
        },
        summary:
          'Two navies traded warnings after a near-collision; one side announced expanded patrols. ' +
          'Shipping insurers flagged higher premiums on the route. No shots fired.',
        prediction: 'Most likely a tense standoff persists; a limited incident is plausible but full conflict unlikely near-term.',
        trace: 'Long-running sovereignty dispute over the waterway; periodic flare-ups for years.',
      },
      {
        topic: {
          title: 'Back-channel talks reopen between the two governments',
          category: 'Politics',
          regions: ['East Asia'],
          sources: [{ url: 'https://example.com/talks-1' }],
        },
        summary: 'Officials confirmed quiet talks aimed at a de-escalation framework; no agreement yet.',
        prediction: 'Talks likely continue intermittently; a formal framework is possible within months.',
        trace: 'Both sides have used back channels before to cap escalation.',
      },
    ],
    cases: [
      { mode: 'guided', lensId: 'scenario' },
      { mode: 'guided', lensId: 'economic' },
      { mode: 'freeform', freeform: 'What would a failure of the talks mean for shipping and energy?' },
    ],
  },
  {
    name: 'single thin story (refusal expected on a forecast)',
    enriched: [
      {
        topic: {
          title: 'Unconfirmed reports of a leadership reshuffle',
          category: 'Politics',
          regions: ['Eurasia'],
          sources: [{ url: 'https://example.com/reshuffle' }],
        },
        summary: 'Unverified social posts claim a senior official was removed; no official confirmation.',
        prediction: '',
        trace: '',
      },
    ],
    cases: [
      { mode: 'guided', lensId: 'scenario' },
    ],
  },
];
