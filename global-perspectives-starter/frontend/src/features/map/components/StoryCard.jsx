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
import { crisisHueForCategory } from '@/features/map/lib/crisisHue.js';
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
  const { loading, summary, analysis, summaryError, analysisError, fetchError } = useStoryCardData(topic);
  if (!topic) return null;

  const id = topic.threadId || topic.topicId || null;
  // F1.7 (review R2): show the topic's real category word (e.g. "climate", "energy") — the
  // crisis-type mapping stays for the hue dot only, never as the visible label (StoryPeek already
  // did this via peekData.js; this brings the card into agreement with it).
  const category = topic.category || null;
  const hue = category ? crisisHueForCategory(category) : null;
  const categoryLabel = category ? String(category) : null;
  const primaryCountry = topic.primaryCountry || (Array.isArray(topic.regions) ? topic.regions[0] : null);
  // F2.18: `asOf` is the whole feed batch's date, shared by every topic — showing it as "updated"
  // on one story implies a per-story check that never happened. Prefer a real per-topic date when
  // the record actually carries one; otherwise say plainly that it's the feed's date, not this
  // story's.
  const topicOwnDate = topic.date || topic.publishedAt || topic.firstSeenAt || topic.updatedAt || null;
  const ownDateLabel = topicOwnDate ? fmtDate(topicOwnDate) : null;
  const feedDateLabel = !ownDateLabel ? fmtDate(asOf) : null;
  const effectiveAsOf = topicOwnDate || asOf;
  const ageDays = effectiveAsOf ? (Date.now() - new Date(effectiveAsOf).getTime()) / 86400000 : null;
  const isOlder = freshnessState(ageDays) === 'older';

  // F2.18: the two fetches are independent — a real failure on one keeps the section that loaded
  // instead of blanking the whole card.
  const summaryItems = !summaryError && summary?.content ? summaryFacts(summary.content, 3) : [];
  const summaryText = summaryItems.length ? summaryItems : null;
  const summaryDateLabel = fmtDate(summary?.generatedAt);
  const trajectoryText = !analysisError && analysis?.trajectory ? firstSentences(analysis.trajectory, 2) : null;
  const causeSteps = !analysisError && analysis?.rootCauseChain ? rootCauseSteps(analysis.rootCauseChain).slice(0, 3) : [];
  const analysisDateLabel = fmtDate(analysis?.generatedAt);

  const openFullStoryHref = threadPath(id);
  const studioId = topic.topicId || topic.threadId || null;
  const studioHref = !fetchError && studioId ? `/analyze?stories=${encodeURIComponent(studioId)}` : null;

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
          {ownDateLabel ? <span className="sc-updated">updated {ownDateLabel}</span> : feedDateLabel ? <span className="sc-updated">stories from {feedDateLabel}</span> : null}
          {isOlder ? <span className="sc-older">older</span> : null}
        </div>
        <h2 className="sc-title">{topic.title}</h2>
      </div>

      {loading ? (
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
              <p className="sc-model-tag">AI SUMMARY OF THE SOURCES{summaryDateLabel ? ` · ${summaryDateLabel}` : ''}</p>
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
        {studioHref ? <Link to={studioHref}>Analyze in Studio →</Link> : null}
      </div>
    </div>
  );
}
