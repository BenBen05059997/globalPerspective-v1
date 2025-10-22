import React from 'react';
import './SummaryDisplay.css'; // Reusing the same CSS styles

/**
 * PredictionDisplay Component
 * Displays AI-generated predictions with interactive features
 */
const PredictionDisplay = ({ 
  prediction, 
  isLoading, 
  error, 
  onRetry, 
  onClear, 
  isCollapsed = false,
  onToggleCollapse
}) => {

  const renderContent = (text) => {
    if (!text) return null;
    // Normalize: strip markdown markers, stray '#', and collapse whitespace
    let normalized = String(text)
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/^\s*#{1,6}\s+/gm, '')
      .replace(/---/g, '')
      .replace(/#/g, '')
      .replace(/\r\n/g, '\n')
      .trim();

    // Join lines like "1.\n\nSocietal..." into a single paragraph
    normalized = normalized.replace(/(\d+\.)\s*\n+/g, '$1 ');
    // Collapse excessive blank lines
    normalized = normalized.replace(/\n{3,}/g, '\n\n');

    // Merge spaced abbreviations like "e. g." -> "e.g." and "U. S." -> "U.S."
    normalized = normalized.replace(/\b([A-Za-z])\.\s*([A-Za-z])\./g, '$1.$2.');

    const paragraphs = normalized
      .split(/\n{2,}/)
      .map(part => part.trim())
      .filter(Boolean);

    return paragraphs.map((paragraph, idx) => (
      <p key={`pred-part-${idx}`} style={{ margin: '6px 0' }}>{paragraph}</p>
    ));
  };

  if (isLoading) {
    return (
      <div className="summary-display loading">
        <div className="summary-header">
          <div className="summary-icon">🔮</div>
          <div className="summary-title">Generating AI Prediction...</div>
        </div>
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            <div className="loading-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
            <p>Our AI is analyzing potential impacts and outcomes</p>
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
          <div className="summary-title">Prediction Generation Failed</div>
        </div>
        <div className="error-content">
          <p className="error-message">{error}</p>
          <div className="error-actions">
            <button 
              className="retry-button"
              onClick={onRetry}
              title="Try generating the prediction again"
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

  if (!prediction) {
    return null;
  }

  const formatGenerationTime = (ms) => {
    if (ms == null) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimestamp = (timestamp) => {
    return timestamp ? new Date(timestamp).toLocaleString() : '';
  };

  // Removed service badge per UI request

  // Simplified display: only show generated text

  return (
    <div className={`summary-display success ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="summary-header" onClick={onToggleCollapse}>
        <div className="summary-icon">🔮</div>
        <div className="summary-title" style={{ fontWeight: 700 }}>AI Prediction</div>
        <div className="summary-badges">
          <span className="word-count-badge" title="Word count">
            {String(prediction.content || '').split(' ').length} words
          </span>
        </div>
        <div className="collapse-toggle">
          {isCollapsed ? '▼' : '▲'}
        </div>
      </div>

      {!isCollapsed && (
        <div className="summary-content">
          <div className="summary-text" style={{ lineHeight: '1.6' }}>
            {renderContent(prediction.content)}
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
          <div className="summary-footer">
            <div className="summary-stats">
              {prediction.generationTime != null && (
                <span className="generation-time" title="Time taken to generate">
                  ⚡ {formatGenerationTime(prediction.generationTime)}
                </span>
              )}
              {prediction.timestamp && (
                <span className="timestamp" title="Generated at">
                  🕒 {formatTimestamp(prediction.timestamp)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictionDisplay;
