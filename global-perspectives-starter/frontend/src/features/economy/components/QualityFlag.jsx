// QualityFlag — surfaces the LLM-as-judge verdict on an economic_impact record.
// Shows a subtle chip only when is_low_quality === true. Tooltip lists failing
// axes (score ≤ 2) and the judge's reason text. See ECONOMIC_DISRUPTION_QUALITY_PLAN.md.
//
// Props:
//   impact: economic_impact record (must contain qualityScores / qualityReasons /
//           is_low_quality if the judge has run; renders nothing otherwise)
//   size?: 'sm' | 'md'

const AXIS_LABEL = {
  coherence: 'Coherence',
  citation_fidelity: 'Citations',
  analog_match: 'Analog match',
  severity_calibration: 'Severity',
  no_bs: 'No-BS',
};

export default function QualityFlag({ impact, size = 'sm' }) {
  if (!impact || impact.is_low_quality !== true) return null;
  const scores = impact.qualityScores || {};
  const reasons = impact.qualityReasons || {};

  const failing = Object.entries(scores)
    .filter(([, v]) => typeof v === 'number' && v <= 2)
    .map(([k]) => k);

  const tooltipLines = failing.map(k => {
    const r = reasons[k] || '';
    const score = scores[k];
    return `${AXIS_LABEL[k] || k} (${score}/5): ${r}`;
  });

  const tooltip = [
    'Auto-judged low quality by Gemini Flash judge.',
    ...tooltipLines,
    '',
    'See /disclosures → Methodology.',
  ].join('\n');

  return (
    <span
      className={`qflag qflag-${size}`}
      title={tooltip}
      aria-label="Low confidence — flagged by automated quality judge"
    >
      ⚑ auto-judged: review
    </span>
  );
}
