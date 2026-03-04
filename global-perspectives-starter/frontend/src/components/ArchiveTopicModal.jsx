import React, { useState, useEffect, useRef } from 'react';
import SummaryDisplay from './SummaryDisplay';
import PredictionDisplay from './PredictionDisplay';
import TraceCauseDisplay from './TraceCauseDisplay';
import './TodayArchiveSidebar.css';
import { useLang } from '../contexts/LanguageContext';
import { t, tCategory, getLocalizedTitle } from '../utils/i18n';

function ArchiveTopicModal({ entry, onClose }) {
  const overlayRef = useRef(null);
  const [activeSection, setActiveSection] = useState('summary');
  const { lang } = useLang();

  // Select AI content based on language
  const aiContent = React.useMemo(() => {
    if (!entry) return null;
    if (lang === 'ja') return entry.ai_ja || entry.ai;
    if (lang === 'zh') return entry.ai_zh || entry.ai;
    return entry.ai;
  }, [entry, lang]);

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
    if (!aiContent) return [];
    return [
      { key: 'summary', label: t('summarize', lang), available: !!aiContent.summary },
      { key: 'prediction', label: t('predict', lang), available: !!aiContent.prediction },
      { key: 'trace_cause', label: t('traceCause', lang), available: !!aiContent.trace_cause },
    ].filter(s => s.available);
  }, [aiContent, lang]);

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
            <h3 className="archive-modal-title">{getLocalizedTitle(entry, lang)}</h3>
            <div className="archive-modal-meta">
              {entry.category && (
                <span className="archive-modal-badge">{tCategory(entry.category, lang)}</span>
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
          {activeSection === 'summary' && aiContent?.summary && (
            <SummaryDisplay
              summary={{ content: aiContent.summary }}
              isLoading={false}
              error={null}
              onRetry={() => {}}
              onClear={() => {}}
              isCollapsed={false}
              onToggleCollapse={() => {}}
            />
          )}

          {activeSection === 'prediction' && aiContent?.prediction && (
            <PredictionDisplay
              prediction={{ content: aiContent.prediction }}
              isLoading={false}
              error={null}
              onRetry={() => {}}
              onClear={() => {}}
              isCollapsed={false}
              onToggleCollapse={() => {}}
            />
          )}

          {activeSection === 'trace_cause' && aiContent?.trace_cause && (
            <TraceCauseDisplay
              traceCause={{ content: aiContent.trace_cause }}
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
            <div className="archive-sources-label">{t('sources', lang)}</div>
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
