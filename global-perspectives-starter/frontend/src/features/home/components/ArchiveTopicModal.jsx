import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import SummaryDisplay from '@/features/home/components/SummaryDisplay';
import PredictionDisplay from '@/features/home/components/PredictionDisplay';
import TraceCauseDisplay from '@/features/home/components/TraceCauseDisplay';
import Tabs, { tabPanelProps } from '@/shared/ui/Tabs.jsx';
import Button from '@/shared/ui/Button.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import '@/features/home/components/TodayArchiveSidebar.css';

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

  // Portalled to <body>: inside the sticky rail it sat in a lower stacking context than the topics rail.
  return createPortal(
    <div className="archive-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="archive-modal" role="dialog" aria-modal="true" aria-label={entry.title}>
        <div className="archive-modal-header">
          <div>
            <h3 className="archive-modal-title">
              {entry.threadId ? <EntityLink kind="story" id={entry.threadId} topic={entry}>{entry.title}</EntityLink> : entry.title}
            </h3>
            <div className="archive-modal-meta">
              <CategoryTag category={entry.category} />
              {entry.regions?.length > 0 && (
                <span className="archive-modal-regions">
                  {entry.regions.map((r, i) => (
                    <span key={r}>{i ? ', ' : ''}<EntityLink kind="country" id={r}>{r}</EntityLink></span>
                  ))}
                </span>
              )}
            </div>
          </div>
          <Button variant="icon" label="Close" onClick={onClose}>&times;</Button>
        </div>

        {sections.length > 0 && (
          <Tabs
            idBase="archive-modal" label="Saved analysis"
            tabs={sections} active={activeSection} onChange={setActiveSection}
          />
        )}

        <div className="archive-modal-content" {...(sections.length > 0 ? tabPanelProps('archive-modal', activeSection) : {})}>
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
            <SectionHeader as="h4" label="Sources" count={entry.sources.length} />
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
    </div>,
    document.body
  );
}

export default ArchiveTopicModal;
