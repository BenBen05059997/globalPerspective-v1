import { useId, useMemo, useState } from 'react';
import AiResultCard from '@/features/home/components/AiResultCard';
import Card from '@/shared/ui/Card.jsx';
import Tabs, { tabPanelProps } from '@/shared/ui/Tabs.jsx';

function tryParseJson(content) {
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
}

// Methodology-v1 triggers (2026-07-04) are structured { text, deadline } objects;
// pre-v1 cached content has plain strings. Normalize both, drop anything else.
function normalizeTrigger(t) {
  if (typeof t === 'string') return { text: t, deadline: null };
  if (t && typeof t === 'object' && typeof t.text === 'string') {
    return { text: t.text, deadline: typeof t.deadline === 'string' ? t.deadline : null };
  }
  return null;
}

// One scenario. Scenarios are peers, so they share one neutral look (no colour by position).
function ScenarioCard({ scenario }) {
  const triggers = (scenario.triggers || []).map(normalizeTrigger).filter(Boolean);
  return (
    <Card level={2} pad="sm" className="ai-scenario">
      <div className="ai-scenario-head">
        <span className="ai-scenario-label">{scenario.label}</span>
        <span className="ai-scenario-p">{scenario.probability_range}</span>
        {scenario.horizon && <span className="ai-scenario-horizon">{scenario.horizon}</span>}
      </div>
      <p className="ai-body">{scenario.rationale}</p>
      {triggers.length > 0 && (
        <div>
          <div className="ai-kicker">Watch for</div>
          <ul className="ai-glyph-list">
            {triggers.map((t, i) => (
              <li key={i}>
                <span className="ai-glyph" aria-hidden="true">›</span>
                <span>
                  {t.text}
                  {t.deadline && <span className="ai-deadline">by {t.deadline}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// Winners / losers: the arrow glyph carries the direction; the text stays on the text ladder.
function OutcomeList({ label, glyph, items }) {
  return (
    <div>
      <div className="ai-kicker">{label}</div>
      <ul className="ai-glyph-list">
        {items.map((item, i) => (
          <li key={i}><span className="ai-glyph" aria-hidden="true">{glyph}</span><span>{item}</span></li>
        ))}
      </ul>
    </div>
  );
}

const TABS = [{ key: 'scenarios', label: 'Scenarios' }, { key: 'outcomes', label: 'Winners & Losers' }];

function JsonPredictionView({ data }) {
  const [tab, setTab] = useState('scenarios');
  const idBase = `pred${useId()}`;
  return (
    <div>
      <Tabs idBase={idBase} label="Forecast views" tabs={TABS} active={tab} onChange={setTab} />
      <div className="ai-result-content" {...tabPanelProps(idBase, tab)}>
        {tab === 'scenarios' && (data.scenarios || []).map((s, i) => <ScenarioCard key={i} scenario={s} />)}
        {tab === 'outcomes' && (
          <div className="ai-outcomes">
            <OutcomeList label="Winners" glyph="↑" items={data.winners || []} />
            <OutcomeList label="Losers" glyph="↓" items={data.losers || []} />
          </div>
        )}
      </div>
    </div>
  );
}

/** PredictionDisplay — a story's scenario forecast (AiResultCard frame). */
const PredictionDisplay = ({ prediction, isLoading, error, onRetry, onClear, isCollapsed = false, onToggleCollapse, lastActive }) => {
  const jsonData = useMemo(() => tryParseJson(prediction?.content), [prediction]);
  return (
    <AiResultCard
      title="Scenario Forecast" loadingText="Mapping chain reactions" what="Prediction"
      hasResult={!!prediction} isLoading={isLoading} error={error} onRetry={onRetry} onClear={onClear}
      isCollapsed={isCollapsed} onToggleCollapse={onToggleCollapse} lastActive={lastActive}
    >
      {jsonData
        ? <JsonPredictionView data={jsonData} />
        : <div className="ai-result-content"><p className="ai-empty">Forecast generation failed — please retry.</p></div>}
    </AiResultCard>
  );
};

export default PredictionDisplay;
