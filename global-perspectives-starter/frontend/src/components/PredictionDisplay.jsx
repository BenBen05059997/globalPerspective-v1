import React, { useState, useMemo, useEffect, useRef } from 'react';
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

// ── Legacy markdown renderer (unchanged for old cached entries) ──────────────

function LegacyPredictionView({ prediction }) {
  const [activeTab, setActiveTab] = useState('chain_reaction');

  const parsedContent = useMemo(() => {
    if (!prediction?.content) return null;
    const text = prediction.content;
    const sections = { chain_reaction: [], winners_losers: [], watchlist: [], score: null };
    let currentSection = 'chain_reaction';
    text.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (lower.includes('chain reaction') || lower.includes('consequences')) currentSection = 'chain_reaction';
      else if (lower.includes('winners') || lower.includes('losers') || lower.includes('benefit')) currentSection = 'winners_losers';
      else if (lower.includes('watchlist') || lower.includes('signals') || lower.includes('future events')) currentSection = 'watchlist';
      sections[currentSection].push(trimmed);
    });
    return sections;
  }, [prediction]);

  const renderMarkdown = (lines) => lines.map((line, idx) => {
    if (line.startsWith('###')) return <h4 key={idx} style={{ margin: '16px 0 8px', color: '#111827', fontSize: '1.05em', fontWeight: 600 }}>{line.replace(/###/g, '').trim()}</h4>;
    const processBold = (text) => text.split(/(\*\*.*?\*\*)/).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i} style={{ color: '#1f2937' }}>{part.slice(2, -2)}</strong> : part
    );
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '8px', paddingLeft: '4px' }}>
          <span style={{ color: 'var(--ai-accent-predict)', fontSize: '1.2em', lineHeight: '1' }}>•</span>
          <span style={{ lineHeight: '1.6', color: '#4b5563' }}>{processBold(line.substring(2))}</span>
        </div>
      );
    }
    if (line.includes('➔')) {
      const steps = line.split('➔').map(s => s.trim()).filter(Boolean);
      if (steps.length === 1) return <div key={idx} className="chain-step-card"><div className="chain-step-content">{processBold(line)}</div></div>;
      return (
        <div key={idx} className="chain-reaction-container">
          {steps.map((step, stepIdx) => (
            <React.Fragment key={`step-${idx}-${stepIdx}`}>
              <div className="chain-step-card">
                <div className="chain-step-number">{stepIdx + 1}</div>
                <div className="chain-step-content">{processBold(step)}</div>
              </div>
              {stepIdx < steps.length - 1 && <div className="chain-arrow" />}
            </React.Fragment>
          ))}
        </div>
      );
    }
    return <p key={idx} style={{ margin: '0 0 12px', lineHeight: '1.6', color: '#4b5563' }}>{processBold(line)}</p>;
  });

  if (!parsedContent) return null;
  return (
    <>
      <div className="ai-tabs">
        {['chain_reaction', 'winners_losers', 'watchlist'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`ai-tab ${activeTab === tab ? 'active' : ''}`}>
            {tab === 'chain_reaction' ? 'Chain Reaction' : tab === 'winners_losers' ? 'Winners & Losers' : 'Watchlist'}
          </button>
        ))}
      </div>
      <div className="ai-result-content">
        {renderMarkdown(parsedContent[activeTab])}
        {parsedContent[activeTab].length === 0 && (
          <p style={{ color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>No prediction data for this section.</p>
        )}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>AI Prediction Model v2.5</span>
          <div className="ai-result-actions" />
        </div>
      </div>
    </>
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

  const jsonData = useMemo(() => {
    if (!prediction?.content) return null;
    if (prediction.contentFormat === 'json') return tryParseJson(prediction.content);
    if (prediction.contentFormat === 'markdown') return null;
    return tryParseJson(prediction.content);
  }, [prediction]);

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
        jsonData ? <JsonPredictionView data={jsonData} /> : <LegacyPredictionView prediction={prediction} />
      )}
    </div>
  );
};

export default PredictionDisplay;
