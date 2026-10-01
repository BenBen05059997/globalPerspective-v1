import { useState, useMemo, useEffect, useRef } from 'react';
import AiUnavailable from '@/features/home/components/AiUnavailable';
import '@/features/home/AIComponents.css';

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

function ScenarioCard({ scenario, index }) {
  const colors = ['var(--ai-predict)', 'var(--tier-low)', 'var(--tier-high)'];
  const color = colors[index % colors.length];
  return (
    <div style={{ border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`, borderRadius: 8, padding: '16px', marginBottom: 12, background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, background: `color-mix(in srgb, ${color} 14%, transparent)`, padding: '2px 8px', borderRadius: 4 }}>
          {scenario.label}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color, fontWeight: 600 }}>{scenario.probability_range}</span>
        {scenario.horizon && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{scenario.horizon}</span>
        )}
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.6, color: 'var(--text-body)' }}>{scenario.rationale}</p>
      {scenario.triggers?.length > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Watch for</div>
          {scenario.triggers.map(normalizeTrigger).filter(Boolean).map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color, fontSize: 12, flexShrink: 0 }}>›</span>
              <span style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.5 }}>
                {t.text}
                {t.deadline && (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', marginLeft: 6, whiteSpace: 'nowrap' }}>by {t.deadline}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JsonPredictionView({ data }) {
  const [tab, setTab] = useState('scenarios');
  return (
    <div>
      <div className="ai-tabs">
        <button className={`ai-tab ${tab === 'scenarios' ? 'active' : ''}`} onClick={() => setTab('scenarios')}>Scenarios</button>
        <button className={`ai-tab ${tab === 'outcomes' ? 'active' : ''}`} onClick={() => setTab('outcomes')}>Winners & Losers</button>
      </div>
      <div className="ai-result-content">
        {tab === 'scenarios' && (
          <div>
            {(data.scenarios || []).map((s, i) => <ScenarioCard key={i} scenario={s} index={i} />)}
          </div>
        )}
        {tab === 'outcomes' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tier-low)', marginBottom: 8, fontWeight: 700 }}>Winners</div>
              {(data.winners || []).map((w, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: 'var(--tier-low)', fontSize: 14 }}>↑</span>
                  <span style={{ fontSize: 14, color: 'var(--text-body)' }}>{w}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tier-high)', marginBottom: 8, fontWeight: 700 }}>Losers</div>
              {(data.losers || []).map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: 'var(--tier-high)', fontSize: 14 }}>↓</span>
                  <span style={{ fontSize: 14, color: 'var(--text-body)' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const PredictionDisplay = ({ prediction, isLoading, error, onRetry, onClear, isCollapsed = false, onToggleCollapse, lastActive }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if ((isLoading || ((prediction || error) && !isCollapsed)) && containerRef.current) {
      setTimeout(() => containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }, [isLoading, prediction, error, isCollapsed, lastActive]);

  const jsonData = useMemo(() => tryParseJson(prediction?.content), [prediction]);

  if (isLoading) {
    return (
      <div ref={containerRef} className="ai-result-card" style={{ padding: '24px', textAlign: 'center' }}>
        <div className="ai-spinner" style={{ position: 'relative', left: 'auto', margin: '0 auto 12px', width: '24px', height: '24px', color: 'var(--ai-accent-predict)' }} />
        <div className="loading-text"><p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Mapping chain reactions...</p></div>
      </div>
    );
  }

  if (error) {
    return <AiUnavailable error={error} containerRef={containerRef} what="Prediction" onRetry={onRetry} onClear={onClear} />;
  }

  if (!prediction) return null;

  return (
    <div ref={containerRef} className="ai-result-card">
      <div className="ai-result-header" onClick={onToggleCollapse} style={{ cursor: 'pointer' }}>
        <div className="ai-result-title" style={{ color: 'var(--ai-accent-predict)' }}>Scenario Forecast</div>
        <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>{isCollapsed ? 'Show' : 'Hide'}</div>
      </div>
      {!isCollapsed && (
        jsonData
          ? <JsonPredictionView data={jsonData} />
          : <div className="ai-result-content"><p style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>Forecast generation failed — please retry.</p></div>
      )}
    </div>
  );
};

export default PredictionDisplay;
