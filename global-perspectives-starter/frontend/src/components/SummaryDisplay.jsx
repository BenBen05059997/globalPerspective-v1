import React from 'react';
import './SummaryDisplay.css';

/**
 * SummaryDisplay Component
 * Displays AI-generated summaries with interactive features
 */
const SummaryDisplay = ({ 
  summary, 
  isLoading, 
  error, 
  onRetry, 
  onClear, 
  isCollapsed = false,
  onToggleCollapse 
}) => {
  // Simplified UI: remove details, export, and clear buttons

  if (isLoading) {
    return (
      <div className="summary-display loading">
        <div className="summary-header">
          <div className="summary-icon">🤖</div>
          <div className="summary-title">Generating AI Summary...</div>
        </div>
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            <div className="loading-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
            <p>Our AI is analyzing the article content</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="summary-display error">
        <div className="summary-header">
          <div className="summary-icon error">⚠️</div>
          <div className="summary-title">Summary Generation Failed</div>
        </div>
        <div className="error-content">
          <p className="error-message">{error}</p>
          <div className="error-actions">
            <button 
              className="retry-button"
              onClick={onRetry}
              title="Try generating the summary again"
            >
              🔄 Retry
            </button>
            <button 
              className="clear-button"
              onClick={onClear}
              title="Clear this error"
            >
              ✕ Clear
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const formatGenerationTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Removed service badge per UI request

  // Removed export handler and metadata toggles per UI simplification

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
      return <p style={{ margin: '6px 0' }}>{normalized}</p>;
    }

    return parts.map((paragraph, idx) => (
      <p key={`summary-part-${idx}`} style={{ margin: '6px 0' }}>
        {paragraph}
      </p>
    ));
  };

  return (
    <div className={`summary-display success ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="summary-header" onClick={onToggleCollapse}>
        <div className="summary-icon">✨</div>
        <div className="summary-title" style={{ fontWeight: 700 }}>AI Summary</div>
        <div className="summary-badges">
          <span className="word-count-badge" title="Word count">
            {summary.wordCount} words
          </span>
        </div>
        <div className="collapse-toggle">
          {isCollapsed ? '▼' : '▲'}
        </div>
      </div>

      {!isCollapsed && (
        <div className="summary-content">
          <div className="summary-text">
            {renderContent(summary.content)}
          </div>

          <div className="summary-footer">
            <div className="summary-stats">
              <span className="generation-time" title="Time taken to generate">
                ⚡ {formatGenerationTime(summary.generationTime)}
              </span>
              <span className="timestamp" title="Generated at">
                🕒 {formatTimestamp(summary.timestamp)}
              </span>
            </div>
            {/* Bottom fold button to collapse the section */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <button
                onClick={onToggleCollapse}
                title="Fold this section"
                style={{
                  padding: '6px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#495057',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500
                }}
              >
                ▲ Fold
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryDisplay;
