const FC_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fcDay(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${FC_MONTHS[+m[2] - 1]} ${+m[3]}` : s;
}
const TODAY = new Date().toISOString().slice(0, 10);

function triggerState(t) {
  if (t.verdict === 'fired') return 'fired';
  if (t.verdict === 'not_fired') return 'notfired';
  if (t.verdict === 'unclear') return 'unclear';
  if (t.deadline && t.deadline < TODAY) return 'awaiting'; // deadline passed, not yet resolved
  return 'pending';
}

const MARK = { fired: '✓', notfired: '✗', unclear: '–', awaiting: '⌛', pending: '☐' };
const TAG = {
  fired: 'happened',
  notfired: "didn't happen",
  unclear: 'unclear',
  awaiting: 'awaiting check',
  pending: null,
};

/**
 * ThreadForecast — Phase 4 "Living forecast" board (presentational). Renders the thread's
 * newest v1 prediction snapshot as dated, falsifiable triggers grouped by scenario. Triggers
 * show pending today and strike through / check as verdicts land. Honest-empty: renders
 * nothing when there's no v1 forecast. Data fetched by the parent via useThreadForecast.
 */
export default function ThreadForecast({ snapshot }) {
  if (!snapshot || !snapshot.scenarios?.length) return null;

  const resolved = snapshot.scenarios
    .flatMap(s => s.triggers)
    .filter(t => t.verdict === 'fired' || t.verdict === 'not_fired').length;
  const total = snapshot.scenarios.flatMap(s => s.triggers).length;

  return (
    <div className="tp-ai-block tp-fc">
      <div className="tp-ai-section-lbl">
        Living forecast{snapshot.generatedAt ? ` · as of ${fcDay(snapshot.generatedAt.slice(0, 10))}` : ''}
      </div>
      <p className="tp-fc-intro">
        Dated, falsifiable triggers logged when the forecast was made. Each is checked as its
        deadline passes — <span className="tp-fc-k pending">☐ open</span>,{' '}
        <span className="tp-fc-k fired">✓ happened</span>,{' '}
        <span className="tp-fc-k notfired">✗ didn&apos;t</span>.
        {total > 0 && <> {resolved}/{total} resolved so far.</>}
      </p>

      {snapshot.scenarios.map((s, si) => (
        <div key={si} className="tp-fc-scenario">
          <div className="tp-fc-shead">
            <span className="tp-fc-slabel">{s.label}</span>
            {s.probability != null && (
              <span className="tp-fc-prob">{Math.round(s.probability * 100)}%</span>
            )}
          </div>
          <ul className="tp-fc-list">
            {s.triggers.map((t, ti) => {
              const st = triggerState(t);
              return (
                <li key={t.id || ti} className={`tp-fc-item ${st}`}>
                  <span className="tp-fc-mark" aria-hidden="true">{MARK[st]}</span>
                  <span className="tp-fc-text">{t.text}</span>
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
    </div>
  );
}
