import { Link } from 'react-router';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import QuestionChip from '@/shared/ui/QuestionChip.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import { legacyNote, boardQid } from '@/shared/lib/questionChips.js';
import { forecastAnchorId, forecastHref } from '@/shared/lib/links.js';
import { triggerState, OUTCOME_TAG as TAG } from '@/features/threads/lib/forecastOutcome.js';

const FC_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fcDay(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${FC_MONTHS[+m[2] - 1]} ${+m[3]}` : s;
}
const MARK = { fired: '✓', notfired: '✗', unclear: '–', awaiting: '⌛', pending: '☐' };

/**
 * ThreadForecast — Phase 4 "Living forecast" board (presentational). Renders the thread's
 * newest v1 prediction snapshot as dated, falsifiable triggers grouped by scenario. Triggers
 * show pending today and strike through / check as verdicts land. Honest-empty: renders
 * nothing when there's no v1 forecast. Data fetched by the parent via useThreadForecast.
 */
export default function ThreadForecast({ snapshot }) {
  if (!snapshot || !snapshot.scenarios?.length) return null;

  const triggers = snapshot.scenarios.flatMap(s => s.triggers);
  const resolved = triggers.filter(t => ['fired', 'notfired'].includes(triggerState(t))).length;
  const total = triggers.length;
  const note = legacyNote(triggers);

  return (
    <div className="tp-ai-block tp-fc">
      <SectionHeader as="h3" label={`Living forecast${snapshot.generatedAt ? ` · as of ${fcDay(snapshot.generatedAt.slice(0, 10))}` : ''}`} />
      <p className="tp-fc-intro">
        Dated, falsifiable triggers logged when the forecast was made. Each outcome is checked
        against our own reporting on this story after it is drawn — <span className="tp-fc-k pending">☐ open</span>,{' '}
        <span className="tp-fc-k fired">✓ happened</span>,{' '}
        <span className="tp-fc-k notfired">✗ not reported</span>.
        {total > 0 && <> {resolved}/{total} resolved so far.</>}
      </p>

      {snapshot.scenarios.map((s, si) => (
        <div key={si} className="tp-fc-scenario">
          <div className="tp-fc-shead">
            {/* a scenario named after its one question would print that sentence twice */}
            {!s.triggers.some(t => t.text === s.label) && <span className="tp-fc-slabel">{s.label}</span>}
            {s.probability != null && (
              <span className="tp-fc-prob">{Math.round(s.probability * 100)}%</span>
            )}
          </div>
          <ul className="tp-fc-list">
            {s.triggers.map((t, ti) => {
              const st = triggerState(t);
              // A scored question has its own entry in the track record; a legacy trigger stays plain text.
              const qid = t.question === true ? t.qid : null;
              return (
                <li key={t.id || ti} id={qid ? forecastAnchorId(qid) : undefined} className={`tp-fc-item ${st}`}>
                  <span className="tp-fc-mark" aria-hidden="true">{MARK[st]}</span>
                  {boardQid(t)
                    ? <EntityLink kind="forecast" id={qid} className="tp-fc-text">{t.text}</EntityLink>
                    : <span className="tp-fc-text">{t.text}</span>}
                  <QuestionChip trigger={t} />
                  <span className="tp-fc-meta">
                    {st === 'fired' || st === 'notfired' || st === 'unclear'
                      ? <>{fcDay(t.deadline)} · {TAG[st]}</>
                      : <>due {fcDay(t.deadline)}{TAG[st] ? ` · ${TAG[st]}` : ''}</>}
                  </span>
                  {t.citation && (st === 'fired' || st === 'notfired') && (
                    /^https?:\/\//.test(t.citation)
                      ? <a className="tp-fc-cite" href={t.citation} target="_blank" rel="noopener noreferrer">source ↗</a>
                      : <span className="tp-fc-cite">{t.citation}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {note && <p className="tp-fc-intro">{note}</p>}
      <div className="tp-fc-foot">
        <Link to={forecastHref()}>How these forecasts are scored →</Link>
      </div>
    </div>
  );
}
