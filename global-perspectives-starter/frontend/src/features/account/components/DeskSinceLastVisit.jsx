import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { buildDeskRows, isStaleSince, readLastVisit, writeLastVisit } from '@/features/account/lib/desk';

// "Since your last visit" (K1 board, left column) — followed countries' real driftNotes newer
// than a per-browser last-visit timestamp. Never invents a row: an empty result says so.
export default function DeskSinceLastVisit({ isMember, followedCountries, countryResults, loading }) {
  // Read once per mount so the list doesn't shift under the reader while they're looking at it;
  // the timestamp itself is only written on the way out (see the effect below).
  const lastVisitRef = useRef(undefined);
  if (lastVisitRef.current === undefined) lastVisitRef.current = readLastVisit();
  const lastVisitIso = lastVisitRef.current;

  // F2.6: only stamp "last visit" once the rows have actually rendered — while `loading` is still
  // true there is nothing on screen yet to have "seen", so writing here (or on an unmount that
  // interrupts the load) would mark changes seen that were never shown.
  useEffect(() => {
    if (loading) return undefined;
    // Update "last visit" after 10s on the Desk, or when the reader navigates away — not
    // immediately, so a refresh doesn't erase the list it just showed.
    const timer = setTimeout(() => writeLastVisit(), 10000);
    return () => {
      clearTimeout(timer);
      writeLastVisit();
    };
  }, [loading]);

  if (!isMember) {
    return (
      <section className="desk-panel desk-changes">
        <div className="desk-kicker">SINCE YOUR LAST VISIT</div>
        <p className="desk-empty">
          Following countries is part of membership. <Link to="/membership">See membership →</Link>
        </p>
      </section>
    );
  }

  if (!followedCountries || followedCountries.length === 0) {
    return (
      <section className="desk-panel desk-changes">
        <div className="desk-kicker">SINCE YOUR LAST VISIT</div>
        <p className="desk-empty">
          You don't follow any country yet · <Link to="/weekly/countries">Follow from a country page.</Link>
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="desk-panel desk-changes">
        <div className="desk-kicker">SINCE YOUR LAST VISIT</div>
        <div className="desk-skeleton-row" />
        <div className="desk-skeleton-row" />
        <div className="desk-skeleton-row" />
      </section>
    );
  }

  const erroredCountries = countryResults.filter((r) => r.error).map((r) => r.country);
  const { rows, firstVisit, anyGated, newestAsOf } = buildDeskRows(countryResults, lastVisitIso);
  const staleLabel = isStaleSince(newestAsOf);

  return (
    <section className="desk-panel desk-changes">
      <div className="desk-kicker">SINCE YOUR LAST VISIT</div>

      {firstVisit && (
        <p className="desk-note">First visit on this browser — showing the latest changes.</p>
      )}

      {rows.length === 0 && !firstVisit && erroredCountries.length < countryResults.length && (
        <p className="desk-empty">No changes since your last visit.</p>
      )}

      {rows.map((r) => (
        <div key={r.key} className="desk-row">
          <div className="desk-row-head">
            {r.dateLabel} · {r.country.toUpperCase()}
            {r.axisLine ? ` · ${r.axisLine}` : ''}
          </div>
          {r.triggerTitle && (
            <div className="desk-row-after">
              After: {r.triggerHref ? <Link to={r.triggerHref}>{r.triggerTitle}</Link> : r.triggerTitle}
              {r.triggerDateLabel ? ` (${r.triggerDateLabel})` : ''}
            </div>
          )}
          {r.why && (
            <div className="desk-row-why">
              <span className="desk-row-why-label">MODEL EXPLANATION (STORED) · </span>
              {r.why}
            </div>
          )}
        </div>
      ))}

      {erroredCountries.map((c) => (
        <p key={c} className="desk-error-line">Couldn't load changes for {c}.</p>
      ))}

      {anyGated && <p className="desk-note">Earlier changes are part of membership.</p>}
      {staleLabel && (
        <p className="desk-note">No new changes since {staleLabel} — analysis paused.</p>
      )}
    </section>
  );
}
