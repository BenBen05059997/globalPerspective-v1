import { useState, useMemo, useEffect, useRef } from 'react';
import './AIComponents.css';

function tryParseJson(content) {
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
}

function ScenarioCard({ scenario, index }) {
  const colors = ['#a2442e', '#4fa07b', '#c94a33'];
  const color = colors[index % colors.length];
  return (
    <div style={{ border: `1px solid ${color}22`, borderRadius: 8, padding: '16px', marginBottom: 12, background: `${color}08` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, background: `${color}18`, padding: '2px 8px', borderRadius: 4 }}>
          {scenario.label}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color, fontWeight: 600 }}>{scenario.probability_range}</span>
        {scenario.horizon && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#888', marginLeft: 'auto' }}>{scenario.horizon}</span>
        )}
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.6, color: '#333' }}>{scenario.rationale}</p>
      {scenario.triggers?.length > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: 6 }}>Watch for</div>
          {scenario.triggers.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color, fontSize: 12, flexShrink: 0 }}>›</span>
              <span style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>{t}</span>
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
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4fa07b', marginBottom: 8, fontWeight: 700 }}>Winners</div>
              {(data.winners || []).map((w, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: '#4fa07b', fontSize: 14 }}>↑</span>
                  <span style={{ fontSize: 14, color: '#333' }}>{w}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#c94a33', marginBottom: 8, fontWeight: 700 }}>Losers</div>
              {(data.losers || []).map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: '#c94a33', fontSize: 14 }}>↓</span>
                  <span style={{ fontSize: 14, color: '#333' }}>{l}</span>
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
        <div className="loading-text"><p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Mapping chain reactions...</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef} className="ai-result-card" style={{ borderColor: '#fca5a5' }}>
        <div className="ai-result-header" style={{ background: '#fef2f2' }}>
          <div className="ai-result-title" style={{ color: '#991b1b' }}>Prediction Failed</div>
          <div className="ai-result-actions">
            <button className="ai-btn" onClick={onRetry} style={{ height: '28px', fontSize: '12px', background: '#fff' }}>Retry</button>
            <button className="ai-btn" onClick={onClear} style={{ height: '28px', fontSize: '12px', background: '#fff' }}>Close</button>
          </div>
        </div>
        <div className="ai-result-content"><p style={{ color: '#b91c1c', margin: 0 }}>{error}</p></div>
      </div>
    );
  }

  if (!prediction) return null;

  return (
    <div ref={containerRef} className="ai-result-card">
      <div className="ai-result-header" onClick={onToggleCollapse} style={{ cursor: 'pointer' }}>
        <div className="ai-result-title" style={{ color: 'var(--ai-accent-predict)' }}>Scenario Forecast</div>
        <div style={{ color: '#9ca3af', fontSize: '12px' }}>{isCollapsed ? 'Show' : 'Hide'}</div>
      </div>
      {!isCollapsed && (
        jsonData
          ? <JsonPredictionView data={jsonData} />
          : <div className="ai-result-content"><p style={{ color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>Forecast generation failed — please retry.</p></div>
      )}
    </div>
  );
};

export default PredictionDisplay;
