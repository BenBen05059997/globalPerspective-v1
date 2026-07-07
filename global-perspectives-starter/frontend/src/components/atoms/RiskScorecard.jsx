import { deriveHeadline, AXES, AXIS_LABELS, tierLabel } from '../../utils/riskTiers';
import { riskScoreToVar } from '../../tokens';
import './RiskScorecard.css';

// Scoring-model-v2 scorecard (SCORING_MODEL_V2_PLAN.md Phase C). Renders a
// country/thread record's dimension breakdown: a worst-axis headline + one bar
// per axis + the per-axis grounding ("why"), so risk explains itself rather than
// hiding behind one number. Renders NOTHING for scalar-only (pre-v2) records —
// the surrounding page still shows the derived tier/score elsewhere.
export default function RiskScorecard({ record, title = 'Risk profile' }) {
  const h = deriveHeadline(record);
  if (!h.axes.length) return null; // no dimensions vector → nothing to break down

  const byAxis = Object.fromEntries(h.axes.map((a) => [a.axis, a]));

  return (
    <section
      className="riskcard"
      aria-label={`${title}: ${tierLabel(h.tier)}, led by ${h.leadLabel} at ${h.score}`}
    >
      <div className="riskcard-hd">
        <span className="riskcard-title">{title}</span>
        <span className="riskcard-headline" style={{ color: riskScoreToVar(h.score) }}>
          {tierLabel(h.tier)} · {h.leadLabel} {h.score}
        </span>
        {h.breadth >= 3 && (
          <span className="riskcard-breadth" title={`${h.breadth} of 4 axes elevated (≥50)`}>
            {h.breadth}/4 axes elevated
          </span>
        )}
      </div>

      <ul className="riskcard-axes">
        {AXES.map((axis) => {
          const a = byAxis[axis];
          const label = AXIS_LABELS[axis];
          if (!a) {
            return (
              <li key={axis} className="riskcard-axis is-null">
                <span className="riskcard-axis-k">{label}</span>
                <span className="riskcard-axis-null">no signal</span>
              </li>
            );
          }
          const color = riskScoreToVar(a.score);
          const isLead = axis === h.leadAxis;
          return (
            <li key={axis} className={`riskcard-axis${isLead ? ' is-lead' : ''}`}>
              <span className="riskcard-axis-k">
                {label}
                {isLead && <span className="riskcard-lead-tag">lead</span>}
              </span>
              <span className="riskcard-bar-track">
                <span className="riskcard-bar-fill" style={{ width: `${a.score}%`, background: color }} />
              </span>
              <span className="riskcard-axis-n" style={{ color }}>{a.score}</span>
              {a.why && <span className="riskcard-axis-why">{a.why}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
