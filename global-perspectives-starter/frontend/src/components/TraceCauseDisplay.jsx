import React, { useState, useMemo, useEffect, useRef } from 'react';
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

// ── Legacy markdown renderer (unchanged for old cached entries) ───────────────

function LegacyTraceCauseView({ traceCause, onClear }) {
  const [activeTab, setActiveTab] = useState('context');

  const parsedContent = useMemo(() => {
    if (!traceCause?.content) return null;
    const text = traceCause.content;
    const sections = { context: [], perspectives: [], timeline: [], score: null, verdict: { classification: null, explanation: null }, impactBreakdown: [] };
    let currentSection = 'context';
    text.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (trimmed.includes('Impact Score') || trimmed.includes('Score (')) {
        const m = trimmed.match(/(\d+)\/10/);
        if (m) sections.score = m[1];
      }
      [{ pattern: /\*?\*?Human Impact\*?\*?/i, category: 'People', icon: '👥' },
       { pattern: /\*?\*?Economic (Reach|Impact)\*?\*?/i, category: 'Economy', icon: '💰' },
       { pattern: /\*?\*?Geopolitical (Stability|Impact)\*?\*?/i, category: 'Regional', icon: '🌍' }
      ].forEach(({ pattern, category, icon }) => {
        if (pattern.test(trimmed)) {
          const sm = trimmed.match(/(\d+)\/10/);
          const em = trimmed.match(/\(([^)]+)\)/);
          if (sm) sections.impactBreakdown.push({ category, icon, score: parseInt(sm[1], 10), explanation: em ? em[1].trim() : '' });
        }
      });
      if (trimmed.includes('Verdict') && trimmed.includes(':')) {
        const verdictText = trimmed.substring(trimmed.indexOf(':') + 1).trim();
        const lv = verdictText.toLowerCase();
        if (lv.includes('true signal') || (lv.includes('signal') && !lv.includes('noise'))) sections.verdict.classification = 'True Signal';
        else if (lv.includes('worth watching') || lv.includes('watching')) sections.verdict.classification = 'Worth Watching';
        else if (lv.includes('noise')) sections.verdict.classification = 'Noise';
        const cleaned = verdictText.replace(/\*\*/g, '').replace(/^[-•]\s*/, '').trim();
        if (sections.verdict.classification) {
          const ci = cleaned.toLowerCase().indexOf(sections.verdict.classification.toLowerCase());
          if (ci !== -1) sections.verdict.explanation = cleaned.substring(ci + sections.verdict.classification.length).replace(/^[:\-–—.\s]+/, '').trim() || null;
        }
        if (!sections.verdict.classification && cleaned) {
          sections.verdict.explanation = cleaned;
          sections.verdict.classification = cleaned.match(/\b(significant|critical|major|important|shapes)\b/i) ? 'True Signal' : cleaned.match(/\b(minor|limited|minimal|localized)\b/i) ? 'Noise' : 'Worth Watching';
        }
      }
      const lower = trimmed.toLowerCase();
      if (lower.includes('context') || lower.includes('how we got here') || lower.includes('origin')) currentSection = 'context';
      else if (lower.includes('perspective') || lower.includes('echo chamber') || lower.includes('bias')) currentSection = 'perspectives';
      else if (lower.includes('timeline') || lower.includes('verdict') || lower.includes('so what')) currentSection = 'timeline';
      const skip = lower.includes('impact score') || lower.includes('human impact') || lower.includes('economic reach') || lower.includes('economic impact') || lower.includes('geopolitical stability') || lower.includes('geopolitical impact') || lower.includes('**verdict') || lower.includes('verdict:');
      if (!skip) sections[currentSection].push(trimmed.replace(/^\*\*:?\s*/, '').replace(/\*\*$/, ''));
    });
    if (sections.impactBreakdown.length > 0 && !sections.verdict.classification) {
      const scores = sections.impactBreakdown.map(i => i.score);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const expl = sections.impactBreakdown.map(i => i.explanation).join(' ').toLowerCase();
      const globalKw = ['global', 'worldwide', 'multiple countries', 'international', 'war', 'invasion', 'pandemic', 'supply chain', 'trade disruption', 'energy crisis', 'financial crisis', 'collapse'];
      if (avg >= 8 && scores.filter(s => s >= 8).length >= 2 && globalKw.some(k => expl.includes(k))) { sections.verdict.classification = 'True Signal'; sections.verdict.explanation = 'High-impact event with global implications.'; }
      else if (avg >= 5 && (Math.max(...scores) >= 7 || ['regional', 'neighboring', 'spillover', 'tensions', 'escalate', 'sanctions'].some(k => expl.includes(k)))) { sections.verdict.classification = 'Worth Watching'; sections.verdict.explanation = 'Moderate-impact event that could escalate regionally.'; }
      else { sections.verdict.classification = 'Noise'; sections.verdict.explanation = 'Low-impact event with limited consequences.'; }
    }
    return sections;
  }, [traceCause]);

  const vcColor = (c) => ({ 'True Signal': { bg: '#ffebee', text: '#c62828', border: '#c62828' }, 'Worth Watching': { bg: '#fff3e0', text: '#ef6c00', border: '#ef6c00' }, 'Noise': { bg: '#e8f5e9', text: '#2e7d32', border: '#2e7d32' } }[c] || { bg: '#f5f5f5', text: '#616161', border: '#9e9e9e' });
  const vcIcon = (c) => ({ 'True Signal': '🔴', 'Worth Watching': '🟠', 'Noise': '🟢' }[c] || '⚪');

  const renderMarkdown = (lines) => lines.map((line, idx) => {
    if (line.startsWith('###')) return <h4 key={idx} style={{ margin: '16px 0 8px', color: '#111827', fontSize: '1.05em', fontWeight: 600 }}>{line.replace(/###/g, '').trim()}</h4>;
    const processBold = (text) => text.split(/(\*\*.*?\*\*)/).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i} style={{ color: '#1f2937' }}>{part.slice(2, -2)}</strong> : part
    );
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '8px', paddingLeft: '4px' }}><span style={{ color: 'var(--ai-accent-trace)', fontSize: '1.2em', lineHeight: '1' }}>•</span><span style={{ lineHeight: '1.6', color: '#4b5563' }}>{processBold(line.substring(2))}</span></div>;
    }
    return <p key={idx} style={{ margin: '0 0 12px', lineHeight: '1.6', color: '#4b5563' }}>{processBold(line)}</p>;
  });

  if (!parsedContent) return null;
  const vc = vcColor(parsedContent.verdict.classification);
  return (
    <>
      {parsedContent.verdict.classification && (
        <div style={{ padding: '16px 20px', backgroundColor: vc.bg, borderBottom: `2px solid ${vc.border}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>{vcIcon(parsedContent.verdict.classification)}</span>
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: vc.text }}>{parsedContent.verdict.classification}</span>
          </div>
          {parsedContent.verdict.explanation && <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5', color: vc.text, opacity: 0.9 }}>{parsedContent.verdict.explanation}</p>}
        </div>
      )}
      {parsedContent.impactBreakdown.length > 0 && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: 8 }}>Impact Breakdown</div>
          {parsedContent.impactBreakdown.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span>{item.icon}</span>
              <span style={{ fontSize: 12, color: '#555', width: 70 }}>{item.category}</span>
              <div style={{ flex: 1, height: 4, background: '#eee', borderRadius: 2 }}><div style={{ height: '100%', width: `${item.score * 10}%`, background: item.score >= 8 ? '#c94a33' : item.score >= 5 ? '#d89540' : '#4fa07b', borderRadius: 2 }} /></div>
              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#666' }}>{item.score}/10</span>
            </div>
          ))}
        </div>
      )}
      <div className="ai-tabs">
        {['context', 'perspectives', 'timeline'].map(t => (
          <button key={t} className={`ai-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'context' ? 'History' : t === 'perspectives' ? 'Perspectives' : 'Timeline'}
          </button>
        ))}
      </div>
      <div className="ai-result-content">
        {renderMarkdown(parsedContent[activeTab])}
        {parsedContent[activeTab].length === 0 && <p style={{ color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>No specific data for this section.</p>}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>Deep Context Agent v1.2</span>
          <div className="ai-result-actions"><div className="ai-action-icon" onClick={onClear} title="Close">✕</div></div>
        </div>
      </div>
    </>
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

  const jsonData = useMemo(() => {
    if (!traceCause?.content) return null;
    if (traceCause.contentFormat === 'json') return tryParseJson(traceCause.content);
    if (traceCause.contentFormat === 'markdown') return null;
    return tryParseJson(traceCause.content);
  }, [traceCause]);

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
        jsonData ? <JsonTraceCauseView data={jsonData} /> : <LegacyTraceCauseView traceCause={traceCause} onClear={onClear} />
      )}
    </div>
  );
};

export default TraceCauseDisplay;
