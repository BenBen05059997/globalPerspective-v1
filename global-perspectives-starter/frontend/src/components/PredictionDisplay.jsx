import React, { useState, useMemo, useEffect, useRef } from 'react';
import './AIComponents.css';

/**
 * PredictionDisplay Component
 * Displays AI-generated Chain Reaction, Winners/Losers & Watchlist
 */
const PredictionDisplay = ({
  prediction,
  isLoading,
  error,
  onRetry,
  onClear,
  isCollapsed = false,
  onToggleCollapse,
  lastActive
}) => {
  const containerRef = useRef(null);
  const [activeTab, setActiveTab] = useState('chain_reaction'); // 'chain_reaction', 'winners_losers', 'watchlist'

  // Auto-scroll logic
  useEffect(() => {
    if ((isLoading || ((prediction || error) && !isCollapsed)) && containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isLoading, prediction, error, isCollapsed, lastActive]);

  // Parse the raw markdown into structured sections
  const parsedContent = useMemo(() => {
    if (!prediction?.content) return null;

    const text = prediction.content;
    const sections = {
      chain_reaction: [],
      winners_losers: [],
      watchlist: [],
      score: null
    };

    let currentSection = 'chain_reaction';
    const lines = text.split('\n');

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Detect Section Headers to switch tabs
      const lower = trimmed.toLowerCase();
      if (lower.includes('chain reaction') || lower.includes('consequences')) {
        currentSection = 'chain_reaction';
      } else if (lower.includes('winners') || lower.includes('losers') || lower.includes('benefit')) {
        currentSection = 'winners_losers';
      } else if (lower.includes('watchlist') || lower.includes('signals') || lower.includes('future events')) {
        currentSection = 'watchlist';
      }

      // Add line to current section
      sections[currentSection].push(trimmed);
    });

    return sections;
  }, [prediction]);

  // Simple Markdown Renderer
  const renderMarkdown = (lines) => {
    return lines.map((line, idx) => {
      // Header ###
      if (line.startsWith('###')) {
        return <h4 key={idx} style={{ margin: '16px 0 8px', color: '#111827', fontSize: '1.05em', fontWeight: 600 }}>{line.replace(/###/g, '').trim()}</h4>;
      }
      // Bold **text**
      const processBold = (text) => {
        const parts = text.split(/(\*\*.*?\*\*)/);
        return parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} style={{ color: '#1f2937' }}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });
      };

      // List Item -
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '8px', paddingLeft: '4px' }}>
            <span style={{ color: 'var(--ai-accent-predict)', fontSize: '1.2em', lineHeight: '1' }}>•</span>
            <span style={{ lineHeight: '1.6', color: '#4b5563' }}>{processBold(line.substring(2))}</span>
          </div>
        );
      }

      // Arrow ➔ visualization
      if (line.includes('➔')) {
        return (
          <div key={idx} style={{
            background: 'rgba(139, 92, 246, 0.05)',
            borderLeft: '3px solid var(--ai-accent-predict)',
            padding: '12px',
            borderRadius: '0 8px 8px 0',
            margin: '8px 0',
            color: '#374151',
            lineHeight: '1.6'
          }}>
            {processBold(line)}
          </div>
        );
      }

      // Standard Paragraph
      return <p key={idx} style={{ margin: '0 0 12px', lineHeight: '1.6', color: '#4b5563' }}>{processBold(line)}</p>;
    });
  };

  if (isLoading) {
    return (
      <div ref={containerRef} className="ai-result-card" style={{ padding: '24px', textAlign: 'center' }}>
        <div className="ai-spinner" style={{ position: 'relative', left: 'auto', margin: '0 auto 12px', width: '24px', height: '24px', color: 'var(--ai-accent-predict)' }}></div>
        <div className="loading-text">
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Mapping chain reactions...</p>
        </div>
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
        <div className="ai-result-content">
          <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!prediction) return null;

  return (
    <div ref={containerRef} className="ai-result-card">
      {/* Header */}
      <div className="ai-result-header" onClick={onToggleCollapse} style={{ cursor: 'pointer' }}>
        <div className="ai-result-title" style={{ color: 'var(--ai-accent-predict)' }}>
          Chain Reaction Prediction
        </div>
        <div style={{ color: '#9ca3af', fontSize: '12px' }}>
          {isCollapsed ? 'Show' : 'Hide'}
        </div>
      </div>

      {!isCollapsed && parsedContent && (
        <>
          {/* Tabs */}
          <div className="ai-tabs">
            <button
              onClick={() => setActiveTab('chain_reaction')}
              className={`ai-tab ${activeTab === 'chain_reaction' ? 'active' : ''}`}
              style={{ width: '33.3%' }}
            >
              Chain Reaction
            </button>
            <button
              onClick={() => setActiveTab('winners_losers')}
              className={`ai-tab ${activeTab === 'winners_losers' ? 'active' : ''}`}
              style={{ width: '33.3%' }}
            >
              Winners & Losers
            </button>
            <button
              onClick={() => setActiveTab('watchlist')}
              className={`ai-tab ${activeTab === 'watchlist' ? 'active' : ''}`}
              style={{ width: '33.3%' }}
            >
              Watchlist
            </button>
          </div>

          {/* Content Area */}
          <div className="ai-result-content">
            {renderMarkdown(parsedContent[activeTab])}
            {parsedContent[activeTab].length === 0 && (
              <p style={{ color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                No prediction data for this section.
              </p>
            )}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>AI Prediction Model v2.5</span>
              <div className="ai-result-actions">
                <div className="ai-action-icon" onClick={onClear} title="Close">✕</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PredictionDisplay;
