import { useState, useMemo, useEffect, useRef } from 'react';
import './AIComponents.css';

function tryParseJson(content) {
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
}

// ── JSON renderer ─────────────────────────────────────────────────────────────

function ImpactBar({ label, score }) {
  const pct = Math.round((score / 10) * 100);
  const color = score >= 7 ? '#c94a33' : score >= 4 ? '#d89540' : '#4fa07b';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666' }}>{label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color }}>{score}/10</span>
      </div>
      <div style={{ height: 4, background: '#eee', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

function CauseChainNode({ label, color, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 4 }} />
        <div style={{ width: 1, flex: 1, background: '#ddd', marginTop: 4 }} />
      </div>
      <div style={{ flex: 1, paddingBottom: 4 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color, fontWeight: 700 }}>{label}</span>
        <div style={{ marginTop: 4 }}>{children}</div>
      </div>
    </div>
  );
}

function JsonTraceCauseView({ data }) {
  const [tab, setTab] = useState('causes');
  const svLabel = data.signalVsNoise?.verdict || '';
  const svColor = svLabel === 'True Signal' ? '#c94a33' : svLabel === 'Noise' ? '#4fa07b' : '#d89540';

  return (
    <div>
      {/* Signal/Noise verdict banner */}
      {svLabel && (
        <div style={{ padding: '10px 16px', background: `${svColor}12`, borderBottom: `2px solid ${svColor}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: svColor }}>{svLabel}</span>
          {data.signalVsNoise?.confidence && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: svColor, opacity: 0.7 }}>{data.signalVsNoise.confidence} confidence</span>
          )}
        </div>
      )}

      <div className="ai-tabs">
        <button className={`ai-tab ${tab === 'causes' ? 'active' : ''}`} onClick={() => setTab('causes')}>Cause Chain</button>
        <button className={`ai-tab ${tab === 'impact' ? 'active' : ''}`} onClick={() => setTab('impact')}>Impact</button>
        <button className={`ai-tab ${tab === 'counter' ? 'active' : ''}`} onClick={() => setTab('counter')}>Counter Reading</button>
      </div>

      <div className="ai-result-content">
        {tab === 'causes' && (
          <div style={{ paddingTop: 4 }}>
            {data.proximate && (
              <CauseChainNode label="Proximate" color="#c94a33">
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#333' }}>{data.proximate.what}</p>
                {data.proximate.when && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888', fontFamily: 'var(--mono)' }}>{data.proximate.when}</p>}
              </CauseChainNode>
            )}
            {(data.contributing || []).map((c, i) => (
              <CauseChainNode key={i} label="Contributing" color="#d89540">
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#333', fontWeight: 500 }}>{c.factor}</p>
                {c.evidence && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666', lineHeight: 1.5 }}>{c.evidence}</p>}
              </CauseChainNode>
            ))}
            {data.structural && (
              <CauseChainNode label="Structural" color="#888">
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#333', fontWeight: 500 }}>{data.structural.factor}</p>
                {data.structural.depth && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888', fontFamily: 'var(--mono)' }}>Building for {data.structural.depth}</p>}
              </CauseChainNode>
            )}
          </div>
        )}

        {tab === 'impact' && data.impactScores && (
          <div style={{ paddingTop: 8 }}>
            <ImpactBar label="Human Impact" score={data.impactScores.humanImpact} />
            <ImpactBar label="Economic Reach" score={data.impactScores.economicReach} />
            <ImpactBar label="Geopolitical" score={data.impactScores.geopolitical} />
          </div>
        )}

        {tab === 'counter' && (
          <div style={{ paddingTop: 4 }}>
            {data.biasNote && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: 6 }}>Source Bias</div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#444' }}>{data.biasNote}</p>
              </div>
            )}
            {data.alternativePerspective && (
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: 6 }}>Alternative Perspective</div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#444' }}>{data.alternativePerspective}</p>
              </div>
            )}
            {!data.biasNote && !data.alternativePerspective && (
              <p style={{ color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>No counter reading available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TraceCauseDisplay = ({ traceCause, isLoading, error, onRetry, onClear, isCollapsed = false, onToggleCollapse, lastActive }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if ((isLoading || ((traceCause || error) && !isCollapsed)) && containerRef.current) {
      setTimeout(() => containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }, [isLoading, traceCause, error, isCollapsed, lastActive]);

  const jsonData = useMemo(() => tryParseJson(traceCause?.content), [traceCause]);

  if (isLoading) {
    return (
      <div ref={containerRef} className="ai-result-card" style={{ padding: '24px', textAlign: 'center' }}>
        <div className="ai-spinner" style={{ position: 'relative', left: 'auto', margin: '0 auto 12px', width: '24px', height: '24px', color: 'var(--ai-accent-trace)' }} />
        <div className="loading-text"><p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Tracing origins & timeline...</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef} className="ai-result-card" style={{ borderColor: '#fca5a5' }}>
        <div className="ai-result-header" style={{ background: '#fef2f2' }}>
          <div className="ai-result-title" style={{ color: '#991b1b' }}>Trace Failed</div>
          <div className="ai-result-actions">
            <button className="ai-btn" onClick={onRetry} style={{ height: '28px', fontSize: '12px', background: '#fff' }}>Retry</button>
            <button className="ai-btn" onClick={onClear} style={{ height: '28px', fontSize: '12px', background: '#fff' }}>Close</button>
          </div>
        </div>
        <div className="ai-result-content"><p style={{ color: '#b91c1c', margin: 0 }}>{error}</p></div>
      </div>
    );
  }

  if (!traceCause) return null;

  return (
    <div ref={containerRef} className="ai-result-card">
      <div className="ai-result-header" onClick={onToggleCollapse} style={{ cursor: 'pointer' }}>
        <div className="ai-result-title" style={{ color: 'var(--ai-accent-trace)' }}>Trace Cause & Context</div>
        <div style={{ color: '#9ca3af', fontSize: '12px' }}>{isCollapsed ? 'Show' : 'Hide'}</div>
      </div>
      {!isCollapsed && (
        jsonData
          ? <JsonTraceCauseView data={jsonData} />
          : <div className="ai-result-content"><p style={{ color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>Analysis generation failed — please retry.</p></div>
      )}
    </div>
  );
};

export default TraceCauseDisplay;
