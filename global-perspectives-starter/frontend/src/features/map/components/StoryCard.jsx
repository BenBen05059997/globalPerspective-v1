// StoryCard — the console's "click a story → its card" (M5b), per the story dossier board
// decision: header -> WHAT IS HAPPENING (summary) -> WHAT IT MEANS (trajectory) -> WHY (root
// cause) -> [Open full story] [Analyze in Studio]. Every block is a strict subset of the data
// already on file for this topic/thread — a block with no data is omitted, never padded with
// placeholder text (CLAUDE.md). Data sources:
//   - header: the topic record already loaded by the feed (no fetch)
//   - WHAT IS HAPPENING: SUMMARY cache (action `summary`, topicId) via useStoryCardData
//   - WHAT IT MEANS: THREAD_ANALYSIS `trajectory` (action `thread_analysis`, threadId)
//   - WHY: THREAD_ANALYSIS `rootCauseChain`, via the shared rootCauseSteps() parser
import { Link } from 'react-router-dom';
import { useStoryCardData } from '@/features/map/hooks/useStoryCardData.js';
import { summaryFacts, firstSentences } from '@/features/map/lib/cardText.js';
import { rootCauseSteps } from '@/shared/lib/rootCause.js';
import { crisisHueForCategory, crisisTypeForCategory, CRISIS_LABEL } from '@/features/map/lib/crisisHue.js';
import { freshnessState } from '@/shared/lib/freshness.js';
import { threadPath } from '@/shared/lib/threadPath';

// Summary/trajectory text shaping lives in lib/cardText.js (bullet-aware; see its header).

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function StoryCard({ topic, asOf, onBack, activeCount = 0 }) {
  const { loading, summary, analysis, fetchError } = useStoryCardData(topic);
  if (!topic) return null;

  const id = topic.threadId || topic.topicId || null;
  const category = topic.category || null;
  const hue = category ? crisisHueForCategory(category) : null;
  const categoryLabel = category ? (CRISIS_LABEL[crisisTypeForCategory(category)] || category) : null;
  const primaryCountry = topic.primaryCountry || (Array.isArray(topic.regions) ? topic.regions[0] : null);
  const updatedLabel = fmtDate(asOf);
  const ageDays = asOf ? (Date.now() - new Date(asOf).getTime()) / 86400000 : null;
  const isOlder = freshnessState(ageDays) === 'older';

  const summaryItems = !fetchError && summary?.content ? summaryFacts(summary.content, 3) : [];
  const summaryText = summaryItems.length ? summaryItems : null;
  const trajectoryText = !fetchError && analysis?.trajectory ? firstSentences(analysis.trajectory, 2) : null;
  const causeSteps = !fetchError && analysis?.rootCauseChain ? rootCauseSteps(analysis.rootCauseChain).slice(0, 3) : [];
  const analysisDateLabel = fmtDate(analysis?.generatedAt);

  const openFullStoryHref = threadPath(id);
  const studioId = topic.topicId || topic.threadId || null;
  const studioHref = studioId ? `/analyze?stories=${encodeURIComponent(studioId)}` : null;

  const hasBody = summaryText || trajectoryText || causeSteps.length > 0;

  return (
    <div className="sh-detail sc-card">
      <button className="sh-back" onClick={onBack}>← All{activeCount ? ` (${activeCount})` : ''}</button>

      <div className="sc-head">
        <div className="sc-head-row">
          {categoryLabel ? (
            <span className="sc-cat">
              <span className="sc-cat-dot" style={{ background: hue || '#9aa4b2' }} aria-hidden="true" />
              {categoryLabel}
            </span>
          ) : null}
          {primaryCountry ? <span className="sc-country">{primaryCountry}</span> : null}
          {updatedLabel ? <span className="sc-updated">updated {updatedLabel}</span> : null}
          {isOlder ? <span className="sc-older">older</span> : null}
        </div>
        <h2 className="sc-title">{topic.title}</h2>
      </div>

      {fetchError ? null : loading ? (
        <div className="sc-skeleton" aria-hidden="true">
          <div className="sc-skel-line" />
          <div className="sc-skel-line" />
          <div className="sc-skel-line sc-skel-short" />
        </div>
      ) : hasBody ? (
        <>
          {summaryText ? (
            <section className="sc-section">
              <h3 className="sc-section-lbl">What is happening</h3>
              <ul className="sc-facts">{summaryText.map((f, i) => <li key={i} className="sc-text">{f}</li>)}</ul>
              <p className="sc-model-tag">AI SUMMARY OF THE SOURCES</p>
            </section>
          ) : null}

          {trajectoryText ? (
            <section className="sc-section">
              <h3 className="sc-section-lbl">What it means</h3>
              <p className="sc-text">{trajectoryText}</p>
              <p className="sc-model-tag">MODEL JUDGMENT{analysisDateLabel ? ` · analysis ${analysisDateLabel}` : ''}</p>
            </section>
          ) : null}

          {causeSteps.length ? (
            <section className="sc-section">
              <h3 className="sc-section-lbl">Why</h3>
              {causeSteps.map((step) => (
                <div key={step.key} className="sc-cause-step">
                  {step.label ? <span className="sc-cause-label">{step.label}</span> : null}
                  <p className="sc-text">{step.text}</p>
                </div>
              ))}
              <p className="sc-model-tag">MODEL JUDGMENT</p>
            </section>
          ) : null}
        </>
      ) : null}

      <div className="sh-detail-foot sc-foot">
        <Link to={openFullStoryHref}>Open full story →</Link>
        {!fetchError && studioHref ? <Link to={studioHref}>Analyze in Studio →</Link> : null}
      </div>
    </div>
  );
}
