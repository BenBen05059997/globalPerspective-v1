import '@/features/analysis-studio/components/SharedTimeBar.css';

// SharedTimeBar — real dates only: the earliest/latest dates actually carried by the sources of a shared run,
// plotted on one axis. Never a manufactured date. Pure CSS/DOM.

export function SharedTimeBar({ dates = [], today }) {
  const clean = [...new Set((Array.isArray(dates) ? dates : []).filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)))].sort();
  if (clean.length === 0) return null;
  const min = Date.parse(`${clean[0].slice(0, 10)}T00:00:00Z`);
  const max = Date.parse(`${clean[clean.length - 1].slice(0, 10)}T00:00:00Z`);
  const span = Math.max(1, max - min);
  const pct = (d) => ((Date.parse(`${d.slice(0, 10)}T00:00:00Z`) - min) / span) * 100;
  const todayPct = today && Date.parse(`${today}T00:00:00Z`) >= min && Date.parse(`${today}T00:00:00Z`) <= max
    ? pct(today) : null;
  return (
    <div className="st-timebar" role="img" aria-label={`Timeline from ${clean[0].slice(0, 10)} to ${clean[clean.length - 1].slice(0, 10)}`}>
      <div className="st-timebar-track" />
      {clean.map((d) => (
        <div key={d} className="st-timebar-tick" style={{ left: `${pct(d)}%` }} title={d.slice(0, 10)} />
      ))}
      {/* Labels only at the ends — intermediate ticks sit too close together on a narrow
          (phone) width for their labels not to overlap; the ticks themselves still mark
          every real date. */}
      {[clean[0], clean[clean.length - 1]].filter((d, i, arr) => arr.indexOf(d) === i).map((d) => (
        <div key={`l-${d}`} className="st-timebar-label" style={{ left: `${pct(d)}%` }}>{d.slice(5, 10)}</div>
      ))}
      {todayPct != null && <div className="st-timebar-tick today" style={{ left: `${todayPct}%` }} title={`Today · ${today}`} />}
    </div>
  );
}
