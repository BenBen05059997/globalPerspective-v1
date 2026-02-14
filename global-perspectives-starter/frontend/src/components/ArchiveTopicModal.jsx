import React, { useState, useEffect, useRef } from 'react';
import SummaryDisplay from './SummaryDisplay';
import PredictionDisplay from './PredictionDisplay';
import TraceCauseDisplay from './TraceCauseDisplay';
import './TodayArchiveSidebar.css';

function ArchiveTopicModal({ entry, onClose }) {
  const overlayRef = useRef(null);
  const [activeSection, setActiveSection] = useState('summary');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const sections = React.useMemo(() => {
    if (!entry?.ai) return [];
    return [
      { key: 'summary', label: 'Summary', available: !!entry.ai.summary },
      { key: 'prediction', label: 'Prediction', available: !!entry.ai.prediction },
      { key: 'trace_cause', label: 'Trace Cause', available: !!entry.ai.trace_cause },
    ].filter(s => s.available);
  }, [entry]);

  useEffect(() => {
    if (sections.length > 0 && !sections.find(s => s.key === activeSection)) {
      setActiveSection(sections[0].key);
    }
  }, [sections, activeSection]);

  if (!entry) return null;

  return (
    <div className="archive-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="archive-modal">
        <div className="archive-modal-header">
          <div>
            <h3 className="archive-modal-title">{entry.title}</h3>
            <div className="archive-modal-meta">
              {entry.category && (
                <span className="archive-modal-badge">{entry.category}</span>
              )}
              {entry.regions?.length > 0 && (
                <span className="archive-modal-regions">
                  {entry.regions.join(', ')}
                </span>
              )}
            </div>
          </div>
          <button className="archive-modal-close" onClick={onClose}>&times;</button>
        </div>

        {sections.length > 0 && (
          <div className="archive-modal-tabs">
            {sections.map(section => (
              <button
                key={section.key}
                className={`archive-modal-tab ${activeSection === section.key ? 'active' : ''}`}
                onClick={() => setActiveSection(section.key)}
              >
                {section.label}
              </button>
            ))}
          </div>
        )}

        <div className="archive-modal-content">
          {activeSection === 'summary' && entry.ai?.summary && (
            <SummaryDisplay
              summary={{ content: entry.ai.summary }}
              isLoading={false}
              error={null}
              onRetry={() => {}}
              onClear={() => {}}
              isCollapsed={false}
              onToggleCollapse={() => {}}
            />
          )}

          {activeSection === 'prediction' && entry.ai?.prediction && (
            <PredictionDisplay
              prediction={{ content: entry.ai.prediction }}
              isLoading={false}
              error={null}
              onRetry={() => {}}
              onClear={() => {}}
              isCollapsed={false}
              onToggleCollapse={() => {}}
            />
          )}

          {activeSection === 'trace_cause' && entry.ai?.trace_cause && (
            <TraceCauseDisplay
              traceCause={{ content: entry.ai.trace_cause }}
              isLoading={false}
              error={null}
              onRetry={() => {}}
              onClear={() => {}}
              isCollapsed={false}
              onToggleCollapse={() => {}}
            />
          )}

          {sections.length === 0 && (
            <div className="archive-modal-empty">
              No AI analysis available for this topic yet.
            </div>
          )}
        </div>

        {Array.isArray(entry.sources) && entry.sources.length > 0 && (
          <div className="archive-modal-sources">
            <div className="archive-sources-label">Sources</div>
            {entry.sources.map((source, idx) => (
              <a
                key={idx}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="archive-source-link"
              >
                {source.title || source.source || 'Source'}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ArchiveTopicModal;
