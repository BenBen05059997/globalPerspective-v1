import React, { useEffect, useRef } from 'react';
import AiUnavailable from '@/features/home/components/AiUnavailable';
import '@/features/home/AIComponents.css';

/**
 * SummaryDisplay Component
 * Displays AI-generated summaries with consistent Premium UI
 */
const SummaryDisplay = ({
  summary,
  isLoading,
  error,
  onRetry,
  onClear,
  isCollapsed = false,
  onToggleCollapse,
  lastActive
}) => {
  const containerRef = useRef(null);

  // Auto-scroll logic
  useEffect(() => {
    // Scroll if loading, or if we have content/error and it is expanded
    if ((isLoading || ((summary || error) && !isCollapsed)) && containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isLoading, summary, error, isCollapsed, lastActive]);

  // Simple Bullet Renderer
  const renderContent = (text) => {
    if (!text) return null;
    let normalized = String(text)
      .replace(/\*\*(.+?)\*\*/g, '$1') // drop bold markers
      .replace(/\r\n/g, '\n')
      .trim();

    // Split on bullet markers "- " while keeping sentences intact.
    const parts = normalized
      .split(/\n?\s*-\s+/)
      .map(part => part.trim())
      .filter(Boolean);

    if (parts.length <= 1) {
      return (
        <p style={{ margin: '0 0 12px', lineHeight: '1.6', color: 'var(--text-body)' }}>
          {normalized}
        </p>
      );
    }

    return parts.map((paragraph, idx) => (
      <div key={`summary-part-${idx}`} style={{ display: 'flex', gap: '10px', marginBottom: '8px', paddingLeft: '4px' }}>
        <span style={{ color: 'var(--ai-accent-summary)', fontSize: '1.2em', lineHeight: '1' }}>•</span>
        <span style={{ lineHeight: '1.6', color: 'var(--text-body)' }}>{paragraph}</span>
      </div>
    ));
  };

  if (isLoading) {
    return (
      <div ref={containerRef} className="ai-result-card" style={{ padding: '24px', textAlign: 'center' }}>
        <div className="ai-spinner" style={{ position: 'relative', left: 'auto', margin: '0 auto 12px', width: '24px', height: '24px', color: 'var(--ai-accent-summary)' }}></div>
        <div className="loading-text">
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Generating concise summary...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <AiUnavailable error={error} containerRef={containerRef} what="Summary" onRetry={onRetry} onClear={onClear} />;
  }

  if (!summary) return null;

  return (
    <div ref={containerRef} className="ai-result-card">
      <div className="ai-result-header" onClick={onToggleCollapse} style={{ cursor: 'pointer' }}>
        <div className="ai-result-title" style={{ color: 'var(--ai-accent-summary)' }}>
          AI Key Takeaways
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
          {isCollapsed ? 'Show' : 'Hide'}
        </div>
      </div>

      {!isCollapsed && (
        <div className="ai-result-content">
          <div className="summary-text">
            {renderContent(summary.content)}
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Fast-Track Summary v1.0</span>
            <div className="ai-result-actions">
              <div className="ai-action-icon" onClick={onClear} title="Close">✕</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryDisplay;
