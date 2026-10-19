// StoryCard — the console's "click a story → its card" (M5b), per the story dossier board
// decision: header -> WHAT IS HAPPENING (summary) -> WHAT IT MEANS (trajectory) -> WHY (root
// cause) -> [Open full story] [Analyze in Studio]. Every block is a strict subset of the data
// already on file for this topic/thread — a block with no data is omitted, never padded with
// placeholder text (CLAUDE.md). Data sources:
//   - header: the topic record already loaded by the feed (no fetch)
//   - WHAT IS HAPPENING: SUMMARY cache (action `summary`, topicId) via useStoryCardData
//   - WHAT IT MEANS: THREAD_ANALYSIS `trajectory` (action `thread_analysis`, threadId)
//   - WHY: THREAD_ANALYSIS `rootCauseChain`, via the shared rootCauseSteps() parser. Each step is
//     tagged with its basis using the story page's own rule (StoryMode legend): FACT = cited dated
//     news, INFERENCE = model judgment. A stored cause step carries no citation, so every step is an
//     INFERENCE; nothing here is ever tagged FACT without data that makes it one.
//   - in-text links: an exact title of another story in the story-web index (`webThreads`, loaded by
//     the console) inside the card's text becomes an EntityLink (cardMentions.js); no other matching.
import { useMemo } from 'react';
import { Link } from 'react-router';
import { knownStoryTitles, linkMentions } from '@/features/map/lib/cardMentions.js';
import { useStoryCardData } from '@/features/map/hooks/useStoryCardData.js';
import { summaryFacts, firstSentences } from '@/shared/lib/cardText.js';
import { rootCauseSteps } from '@/shared/lib/rootCause.js';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import { freshnessState } from '@/shared/lib/freshness.js';
import { storyHref, studioHref as studioPath } from '@/shared/lib/links.js';
import EntityLink from '@/shared/ui/EntityLink.jsx';

// Summary/trajectory text shaping lives in shared/lib/cardText.js (bullet-aware; see its header).

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// A card text with its exact story-title mentions turned into EntityLinks (StoryPeek on hover/focus).
function Mentions({ text, known }) {
  const segs = useMemo(() => linkMentions(text, known), [text, known]);
  return segs.map((seg, i) => (seg.threadId
    ? <EntityLink kind="story" key={i} inline id={seg.threadId} topic={{ title: seg.text }} data-mention={seg.threadId}>{seg.text}</EntityLink>
    : <span key={i}>{seg.text}</span>));
}

export default function StoryCard({ topic, asOf, onBack, activeCount = 0, webThreads = null, linked = null }) {
  const { loading, summary, analysis, summaryError, analysisError, fetchError } = useStoryCardData(topic);
  const known = useMemo(() => knownStoryTitles(webThreads, topic?.threadId || null), [webThreads, topic?.threadId]);
  if (!topic) return null;

  // F1.7 (review R2): show the topic's real category word (e.g. "climate", "energy") — the
  // crisis-type mapping stays for the hue dot only (CategoryTag), never as the visible label.
  const category = topic.category ? String(topic.category) : null;
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

  // The story page only for a real thread id (a topic id is not a story address).
  const openFullStoryHref = topic.threadId ? storyHref(topic.threadId) : null;
  const studioId = topic.topicId || topic.threadId || null;
  const studioHref = !fetchError && studioId ? studioPath(studioId) : null;

  const linkedInto = linked?.into || [];
  const linkedFrom = linked?.from || [];
  const hasBody = summaryText || trajectoryText || causeSteps.length > 0 || linkedInto.length > 0 || linkedFrom.length > 0;

  return (
    <div className="sh-detail sc-card">
      <button className="sh-back" onClick={onBack}>← All{activeCount ? ` (${activeCount})` : ''}</button>

      <div className="sc-head">
        <div className="sc-head-row">
          <CategoryTag category={category} />
          {primaryCountry ? <EntityLink kind="country" id={primaryCountry} className="sc-country">{primaryCountry}</EntityLink> : null}
          {ownDateLabel ? <span className="sc-updated">updated {ownDateLabel}</span> : feedDateLabel ? <span className="sc-updated">stories from {feedDateLabel}</span> : null}
          {isOlder ? <span className="sh-older">older</span> : null}
        </div>
        <h2 className="sc-title">{topic.title}</h2>
      </div>

      {loading ? (
        <BootLoader variant="inline" label="Loading the story card" text="Loading the story card" />
      ) : hasBody ? (
        <>
          {summaryText ? (
            <section className="sc-section">
              <SectionHeader as="h3" label="What is happening" />
              <ul className="sc-facts">{summaryText.map((f, i) => <li key={i} className="sc-text"><Mentions text={f} known={known} /></li>)}</ul>
              <p className="sc-model-tag">AI SUMMARY OF THE SOURCES{summaryDateLabel ? ` · ${summaryDateLabel}` : ''}</p>
            </section>
          ) : null}

          {trajectoryText ? (
            <section className="sc-section">
              <SectionHeader as="h3" label="What it means" />
              <p className="sc-text"><Mentions text={trajectoryText} known={known} /></p>
              <p className="sc-model-tag">MODEL JUDGMENT{analysisDateLabel ? ` · analysis ${analysisDateLabel}` : ''}</p>
            </section>
          ) : null}

          {causeSteps.length ? (
            <section className="sc-section">
              <SectionHeader as="h3" label="Why" />
              {causeSteps.map((step) => (
                <div key={step.key} className="sc-cause-step">
                  {step.label ? <span className="sc-cause-label">{step.label}</span> : null}
                  <p className="sc-text">
                    <span className="sc-basis sc-basis--inference" data-basis="inference">INFERENCE</span>
                    <Mentions text={step.text} known={known} />
                  </p>
                </div>
              ))}
              <p className="sc-model-tag">MODEL JUDGMENT · <span className="sc-basis sc-basis--inference">INFERENCE</span> model judgment, not a reported fact</p>
            </section>
          ) : null}

          {linkedInto.length || linkedFrom.length ? (
            <section className="sc-section" data-testid="card-linked">
              <SectionHeader as="h3" label="Linked stories" />
              {linkedInto.length ? (
                <p className="sc-text">
                  Judged to feed into:{' '}
                  {linkedInto.map((l, i) => (
                    <span key={l.id}>{i > 0 ? ' · ' : ''}<EntityLink kind="story" inline id={l.id} topic={{ title: l.title }}>{l.title}</EntityLink>{l.confidence ? ` (${l.confidence})` : ''}</span>
                  ))}
                </p>
              ) : null}
              {linkedFrom.length ? (
                <p className="sc-text">
                  Earlier news judged to feed in:{' '}
                  {linkedFrom.map((l, i) => (
                    <span key={l.id}>{i > 0 ? ' · ' : ''}<EntityLink kind="story" inline id={l.id} topic={{ title: l.title }}>{l.title}</EntityLink>{l.confidence ? ` (${l.confidence})` : ''}</span>
                  ))}
                </p>
              ) : null}
              <p className="sc-model-tag"><span className="sc-basis sc-basis--inference">INFERENCE</span> model judgment from the story-web index, not a reported fact</p>
            </section>
          ) : null}
        </>
      ) : null}

      <div className="sh-detail-foot sc-foot">
        {openFullStoryHref ? <Link to={openFullStoryHref}>Open full story →</Link> : null}
        {studioHref ? <Link to={studioHref}>Analyze in Studio →</Link> : null}
      </div>
    </div>
  );
}
