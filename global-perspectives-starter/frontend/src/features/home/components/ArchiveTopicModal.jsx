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
import contentService from '@/shared/data/contentService';
import { reportFetchError } from '@/shared/api/errorSink';
import '@/features/home/components/TodayArchiveSidebar.css';

// The archive keeps only the first 1,500 characters of a forecast or trace cause (the agent's archive trim), so
// most saved JSON is cut and does not parse. A cut text is replaced by the full note read by topicId (the today
// view's notes, else the stored result); when there is none, the tab is left out rather than shown as "failed".
const FULL_NOTE = { prediction: 'getTopicPrediction', trace_cause: 'getTopicTraceCause' };

function parses(text) {
  try { JSON.parse(text); return true; } catch { return false; }
}

// { prediction, trace_cause } -> the text to show, undefined while the full note loads, null when there is none.
function useSavedJson(entry) {
  const [full, setFull] = useState({});
  useEffect(() => {
    let live = true;
    setFull({});
    for (const [kind, method] of Object.entries(FULL_NOTE)) {
      const text = entry?.ai?.[kind];
      if (!text || parses(text)) continue;
      contentService[method](entry.topicId)
        .then((d) => (typeof d?.content === 'string' && parses(d.content) ? d.content : null))
        .catch((err) => {
          if (!/cache miss/i.test(err?.message || '')) reportFetchError(`today-archive-${kind}`, err);
          return null;
        })
        .then((content) => { if (live) setFull((p) => ({ ...p, [kind]: content })); });
    }
    return () => { live = false; };
  }, [entry]);
  const out = {};
  for (const kind of Object.keys(FULL_NOTE)) {
    const text = entry?.ai?.[kind];
    if (!text) out[kind] = null;
    else out[kind] = parses(text) ? text : full[kind];
  }
  return out;
}

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

  const saved = useSavedJson(entry);
  const sections = [
    { key: 'summary', label: 'Summary', available: !!entry?.ai?.summary },
    { key: 'prediction', label: 'Prediction', available: saved.prediction !== null },
    { key: 'trace_cause', label: 'Trace Cause', available: saved.trace_cause !== null },
  ].filter(s => s.available);
  const sectionKeys = sections.map(s => s.key).join();

  useEffect(() => {
    const keys = sectionKeys.split(',');
    if (sectionKeys && !keys.includes(activeSection)) setActiveSection(keys[0]);
  }, [sectionKeys, activeSection]);

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

          {activeSection === 'prediction' && saved.prediction !== null && (
            <PredictionDisplay
              prediction={saved.prediction ? { content: saved.prediction } : null}
              isLoading={saved.prediction === undefined}
              error={null}
              onRetry={() => {}}
              onClear={() => {}}
              isCollapsed={false}
              onToggleCollapse={() => {}}
            />
          )}

          {activeSection === 'trace_cause' && saved.trace_cause !== null && (
            <TraceCauseDisplay
              traceCause={saved.trace_cause ? { content: saved.trace_cause } : null}
              isLoading={saved.trace_cause === undefined}
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
