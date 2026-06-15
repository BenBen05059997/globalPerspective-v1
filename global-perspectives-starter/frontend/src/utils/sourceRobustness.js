// Source robustness (L1 of the source-truth layer): is the analysis built on
// corroborated reporting, or a single unverified outlet? Pure + dependency-free.
// Mirrors quality/analysis/source_check.mjs so the live Studio and the offline
// check agree. Faithfulness/quality checks verify the OUTPUT; this checks the
// trustworthiness of the INPUT (see ANALYSIS_SOURCE_TRUTH_PLAN.md).

const LOW_TIER_TYPES = ['social', 'blog', 'opinion'];

// Assess one topic's sourcing from its sources[] metadata.
export function assessTopicSources(topic) {
  const sources = Array.isArray(topic?.sources) ? topic.sources : [];
  const n = sources.length;
  const outlets = new Set(sources.map((s) => (s.source || '').toLowerCase()).filter(Boolean));
  const primary = sources.filter((s) => s.tier === 'primary').length;
  const lowOnly = n > 0 && sources.every((s) => LOW_TIER_TYPES.includes(s.outletType));
  let level; // none | single | low | weak | moderate | well
  if (n === 0) level = 'none';
  else if (n === 1 || outlets.size === 1) level = 'single';
  else if (lowOnly) level = 'low';
  else if (outlets.size >= 4 && primary >= 2) level = 'well';
  else if (outlets.size >= 2) level = 'moderate';
  else level = 'weak';
  return { level, n, outlets: outlets.size, primary };
}

// A story is "shaky" if its premise rests on one outlet / only low-credibility / nothing.
const SHAKY = new Set(['single', 'low', 'none']);

// Assess the whole selected set → a banner-ready summary.
export function assessSelection(topics) {
  const per = (topics || []).map((t) => ({ title: t?.title || 'Untitled', ...assessTopicSources(t) }));
  const shaky = per.filter((p) => SHAKY.has(p.level));
  const total = per.length;
  let severity = 'ok'; // ok | warn
  let message = '';
  if (total && shaky.length) {
    severity = 'warn';
    const noun = shaky.length === 1 ? 'story rests' : 'stories rest';
    message = `${shaky.length} of ${total} selected ${noun} on a single or low-credibility outlet — treat those as unverified and corroborate before relying on them.`;
  } else if (total) {
    severity = 'ok';
    message = `All ${total} selected ${total === 1 ? 'story is' : 'stories are'} corroborated by multiple outlets.`;
  }
  return { per, shaky, shakyCount: shaky.length, total, severity, message };
}
