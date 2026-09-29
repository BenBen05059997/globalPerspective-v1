// CountryCardV2 — the S4 one-screen country card (COUNTRY_VIEW_DISCUSSION.md "Debate outcome":
// state line -> verified facts only -> one-sentence summary -> RISK + DIRECTION -> 4 risk bars
// (WHY on click) -> latest change (only with a cited event) -> <=3 stories -> <=2 future dated
// triggers -> FX + Studio button. Stored data only — no AI run on view.
//
// Mounted from two places: the /map console (SituationHome, passed `situations` for the watch
// flag) and the public /weekly/country/:name page (CountryPage, no `situations` — watch flag
// omitted there rather than duplicating the map's world fetch). Themed entirely off the shared
// --ink/--paper/--line tokens so it follows both the light page and the .gp-console dark theme
// with no separate dark-mode CSS.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCountryIntelligence } from '@/features/countries/hooks/useCountryIntelligence.js';
import { useCountryHistory } from '@/features/countries/hooks/useCountryHistory.js';
import { useMarketsCountry } from '@/features/economy/hooks/useMarketsCountry.js';
import { useCountryStories } from '@/features/countries/hooks/useCountryStories.js';
import { computeCountryDirection, directionLabel } from '@/features/countries/lib/countryDirection.js';
import { countryWatchFlag } from '@/features/countries/lib/countryWatch.js';
import { futureDatedTriggers } from '@/features/countries/lib/countryTriggers.js';
import { fxRowForCountry } from '@/features/countries/lib/countryCurrency.js';
import { deriveHeadline, AXES, tierLabel } from '@/shared/lib/riskTiers.js';
import { riskScoreToVar } from '@/shared/styles/tokens';
import { freshnessState, COUNTRY_OLDER_AFTER_DAYS } from '@/shared/lib/freshness.js';
import { iso3ForName } from '@/features/map/lib/situationLabels.js';
import { threadPath } from '@/shared/lib/threadPath.js';
import { macroRows } from '@/features/countries/lib/countryMacro.js';
import '@/features/countries/components/CountryCardV2.css';

function fmtShort(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function CountryCardV2({ name, situations = null, onBack = null, onClose = null, variant = 'panel' }) {
  const namesArr = useMemo(() => (name ? [name] : []), [name]);
  const { intelligence, loading: intelLoading } = useCountryIntelligence(namesArr);
  const intel = name ? intelligence[name] : null;

  const { snapshots, driftNotes, loading: historyLoading } = useCountryHistory(name);
  const { data: markets } = useMarketsCountry(name);
  const { stories, deadlines, topicIdToThreadId, loading: storiesLoading } = useCountryStories(name);

  const [openAxis, setOpenAxis] = useState(null);

  const now = Date.now();
  const ageDays = intel?.generatedAt ? (now - new Date(intel.generatedAt).getTime()) / 86400000 : null;
  const fresh = intel && ageDays != null ? freshnessState(ageDays, COUNTRY_OLDER_AFTER_DAYS) : null;

  // State (COUNTRY_VIEW_DISCUSSION.md "Frontend: four country states" + the v2 five-state note):
  // briefed (<14d, weekly cadence) / briefed-older (14-30d) / too-old (>30d, scores hidden) / never-briefed / quiet.
  let state;
  if (intel && fresh !== 'hidden') state = fresh === 'older' ? 'older' : 'briefed';
  else if (intel && fresh === 'hidden') state = 'too_old';
  else if (stories.length > 0) state = 'never_briefed';
  else state = 'quiet';

  const headline = intel ? deriveHeadline(intel) : deriveHeadline(null);
  const direction = computeCountryDirection(snapshots, now);
  const iso3 = iso3ForName(name);
  const watch = situations ? countryWatchFlag(situations, iso3, now) : null;
  const triggers = futureDatedTriggers(deadlines, now, 2);
  const fx = fxRowForCountry(name, markets?.fx);
  const macro = macroRows(markets?.macro);

  const latestChange = useMemo(() => {
    const note = (driftNotes || []).find((d) => d?.triggerEvent?.title && d?.whyChanged);
    if (!note) return null;
    const threadId = topicIdToThreadId.get(note.triggerEvent.topicId) || null;
    return { asOf: note.asOf, why: note.whyChanged, eventTitle: note.triggerEvent.title, threadId };
  }, [driftNotes, topicIdToThreadId]);

  if (!name) return null;

  const loading = intelLoading || historyLoading || storiesLoading;

  return (
    <div className={`ccv2 ccv2-${variant}`} role="region" aria-label={`${name} country card`}>
      <div className="ccv2-head">
        {onBack ? <button className="ccv2-back" onClick={onBack}>← Back</button> : null}
        <h2 className="ccv2-name">{name}</h2>
        {watch ? (
          <span className={`ccv2-watch ccv2-watch-${watch.kind}`} title={watch.label}>
            ⚑ WATCH
          </span>
        ) : null}
        {onClose ? <button className="ccv2-close" onClick={onClose} aria-label="Close">✕</button> : null}
      </div>

      {/* 1. State line — always a real date, never a placeholder. */}
      <div className={`ccv2-state ccv2-state-${state}`}>
        {state === 'briefed' && intel?.generatedAt && `Briefed ${fmtShort(intel.generatedAt)}`}
        {state === 'older' && intel?.generatedAt && `Briefed ${fmtShort(intel.generatedAt)} · older`}
        {state === 'too_old' && intel?.generatedAt && `Last briefed ${fmtShort(intel.generatedAt)} — too old to score`}
        {state === 'never_briefed' && 'No AI briefing this cycle (we brief the 20 most-covered countries)'}
        {state === 'quiet' && 'No coverage in the last 30 days'}
        {loading && !intel ? ' · loading…' : null}
      </div>

      {/* 2. Verified facts only — leader/capital/population/government need the Wikidata facts
          job (D7, not built); omitted rather than guessed. Macro only if <=3 years old. */}
      {(macro.length || fx) ? (
        <div className="ccv2-facts">
          {macro.map((r) => (
            <span key={r.k} className="ccv2-fact"><b>{r.v}</b> {r.k} ({r.year})</span>
          ))}
          {fx ? <span className="ccv2-fact"><b>{fx.rate.toFixed(4)}</b> {fx.currency}/{fx.base} <span className="ccv2-fact-date">{fmtShort(markets?.fx?.asOf)}</span></span> : null}
        </div>
      ) : null}

      {/* 3. One-sentence summary */}
      {intel?.bluf && (state === 'briefed' || state === 'older') ? (
        <p className="ccv2-summary">{intel.bluf}</p>
      ) : null}

      {/* 4. RISK + DIRECTION */}
      {(state === 'briefed' || state === 'older') && headline.score != null ? (
        <div className="ccv2-triad">
          <span className="ccv2-risk" style={{ color: riskScoreToVar(headline.score) }}>
            RISK {headline.score} · {tierLabel(headline.tier)}
          </span>
          <span className="ccv2-direction">
            {direction.state === 'arrow' ? (direction.arrow === 'up' ? '▲' : '▼') : direction.state === 'top' ? '◆' : ''}
            {' '}{directionLabel(direction)}
            {direction.axis ? ` (${direction.axis.label})` : ''}
            {direction.priorAsOf && (direction.state === 'arrow' || direction.state === 'unchanged') ? ` · vs ${fmtShort(direction.priorAsOf)}` : ''}
          </span>
        </div>
      ) : null}

      {/* 5. Four risk bars — WHY on click */}
      {(state === 'briefed' || state === 'older') && headline.axes.length > 0 ? (
        <ul className="ccv2-bars">
          {AXES.map((axis) => {
            const a = headline.axes.find((x) => x.axis === axis);
            if (!a) return <li key={axis} className="ccv2-bar ccv2-bar-null"><span className="ccv2-bar-k">{axis}</span><span className="ccv2-bar-null">no signal</span></li>;
            const isOpen = openAxis === axis;
            return (
              <li key={axis} className="ccv2-bar">
                <button
                  className="ccv2-bar-btn"
                  onClick={() => setOpenAxis(isOpen ? null : axis)}
                  aria-expanded={isOpen}
                >
                  <span className="ccv2-bar-k">{a.label}</span>
                  <span className="ccv2-bar-track"><span className="ccv2-bar-fill" style={{ width: `${a.score}%`, background: riskScoreToVar(a.score) }} /></span>
                  <span className="ccv2-bar-n">{a.score}</span>
                </button>
                {isOpen && a.why ? <p className="ccv2-bar-why">{a.why}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* 6. Latest change — only with a cited event */}
      {latestChange ? (
        <div className="ccv2-change">
          <span className="ccv2-change-date">{fmtShort(latestChange.asOf)}</span>{' '}
          {/* Drift explanations are model text and can contradict the score move (D9, not built):
              label them, never present them as fact. */}
          <span className="ccv2-mj">model judgment</span>{' '}
          {latestChange.why}{' '}
          {latestChange.threadId ? (
            <Link to={threadPath(latestChange.threadId, { from: 'country', country: name })}>{latestChange.eventTitle} →</Link>
          ) : (
            <span className="ccv2-change-cite">({latestChange.eventTitle})</span>
          )}
        </div>
      ) : null}

      {/* 7. Stories */}
      {stories.length > 0 ? (
        <ul className="ccv2-stories">
          {stories.map((s) => (
            <li key={s.threadId || s.topicId}>
              {s.threadId ? (
                <Link to={threadPath(s.threadId, { from: 'country', country: name })}>{s.title}</Link>
              ) : (
                <span>{s.title}</span>
              )}
              <span className="ccv2-story-date">{fmtShort(s.date)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* 8. Future dated triggers */}
      {triggers.length > 0 ? (
        <ul className="ccv2-triggers">
          {triggers.map((t) => (
            <li key={t.id}>{t.label} · <b>{t.daysLeft}d left</b></li>
          ))}
        </ul>
      ) : null}

      {state === 'never_briefed' ? (
        <Link className="ccv2-studio-btn ccv2-generate" to="/analyze">Generate a briefing in Studio →</Link>
      ) : (
        <Link className="ccv2-studio-btn" to="/analyze">Analyze in Studio →</Link>
      )}
    </div>
  );
}
