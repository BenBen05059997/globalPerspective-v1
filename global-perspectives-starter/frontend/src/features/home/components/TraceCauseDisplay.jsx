import { useId, useMemo, useState } from 'react';
import AiResultCard from '@/features/home/components/AiResultCard';
import Tabs, { tabPanelProps } from '@/shared/ui/Tabs.jsx';

function tryParseJson(content) {
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
}

// ── JSON renderer ─────────────────────────────────────────────────────────────

// An impact score out of 10: the number is the reading, the bar a neutral length (never a tier colour).
function ImpactBar({ label, score }) {
  const pct = Math.round((score / 10) * 100);
  return (
    <div className="ai-impact">
      <div className="ai-impact-head">
        <span className="ai-kicker">{label}</span>
        <span className="ai-impact-score">{score}/10</span>
      </div>
      <div className="ai-impact-track"><div className="ai-impact-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

// One link in the cause chain. `depth` sets the node's weight on the text ladder (proximate is the
// strongest mark, structural the faintest): position in the chain, not a severity colour.
function CauseChainNode({ label, depth, children }) {
  return (
    <div className={`ai-chain ai-chain--${depth}`}>
      <div className="ai-chain-rail" aria-hidden="true"><span className="ai-chain-dot" /><span className="ai-chain-line" /></div>
      <div className="ai-chain-body">
        <span className="ai-kicker ai-chain-label">{label}</span>
        <div className="ai-chain-text">{children}</div>
      </div>
    </div>
  );
}

const TABS = [
  { key: 'causes', label: 'Cause Chain' },
  { key: 'impact', label: 'Impact' },
  { key: 'counter', label: 'Counter Reading' },
];

function JsonTraceCauseView({ data }) {
  const [tab, setTab] = useState('causes');
  const idBase = `trace${useId()}`;
  const verdict = data.signalVsNoise?.verdict || '';

  return (
    <div>
      {/* Signal / noise verdict: the word is the reading; no colour per verdict */}
      {verdict && (
        <div className="ai-verdict">
          <span className="ai-verdict-word">{verdict}</span>
          {data.signalVsNoise?.confidence && (
            <span className="ai-verdict-conf">{data.signalVsNoise.confidence} confidence</span>
          )}
        </div>
      )}

      <Tabs idBase={idBase} label="Trace views" tabs={TABS} active={tab} onChange={setTab} />

      <div className="ai-result-content" {...tabPanelProps(idBase, tab)}>
        {tab === 'causes' && (
          <div>
            {data.proximate && (
              <CauseChainNode label="Proximate" depth="proximate">
                <p className="ai-body">{data.proximate.what}</p>
                {data.proximate.when && <p className="ai-note ai-note--mono">{data.proximate.when}</p>}
              </CauseChainNode>
            )}
            {(data.contributing || []).map((c, i) => (
              <CauseChainNode key={i} label="Contributing" depth="contributing">
                <p className="ai-body ai-body--strong">{c.factor}</p>
                {c.evidence && <p className="ai-note">{c.evidence}</p>}
              </CauseChainNode>
            ))}
            {data.structural && (
              <CauseChainNode label="Structural" depth="structural">
                <p className="ai-body ai-body--strong">{data.structural.factor}</p>
                {data.structural.depth && <p className="ai-note ai-note--mono">Building for {data.structural.depth}</p>}
              </CauseChainNode>
            )}
          </div>
        )}

        {tab === 'impact' && data.impactScores && (
          <div>
            <ImpactBar label="Human Impact" score={data.impactScores.humanImpact} />
            <ImpactBar label="Economic Reach" score={data.impactScores.economicReach} />
            <ImpactBar label="Geopolitical" score={data.impactScores.geopolitical} />
          </div>
        )}

        {tab === 'counter' && (
          <div>
            {data.biasNote && (
              <div className="ai-counter">
                <div className="ai-kicker">Source Bias</div>
                <p className="ai-body">{data.biasNote}</p>
              </div>
            )}
            {data.alternativePerspective && (
              <div className="ai-counter">
                <div className="ai-kicker">Alternative Perspective</div>
                <p className="ai-body">{data.alternativePerspective}</p>
              </div>
            )}
            {!data.biasNote && !data.alternativePerspective && (
              <p className="ai-empty">No counter reading available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** TraceCauseDisplay — a story's cause chain, impact and counter reading (AiResultCard frame). */
const TraceCauseDisplay = ({ traceCause, isLoading, error, onRetry, onClear, isCollapsed = false, onToggleCollapse, lastActive }) => {
  const jsonData = useMemo(() => tryParseJson(traceCause?.content), [traceCause]);
  return (
    <AiResultCard
      title="Trace Cause & Context" loadingText="Tracing origins and timeline" what="Trace cause"
      hasResult={!!traceCause} isLoading={isLoading} error={error} onRetry={onRetry} onClear={onClear}
      isCollapsed={isCollapsed} onToggleCollapse={onToggleCollapse} lastActive={lastActive}
    >
      {jsonData
        ? <JsonTraceCauseView data={jsonData} />
        : <div className="ai-result-content"><p className="ai-empty">Analysis generation failed — please retry.</p></div>}
    </AiResultCard>
  );
};

export default TraceCauseDisplay;
