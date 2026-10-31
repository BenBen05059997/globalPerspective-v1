import '@/features/board/panels.css';
import { dayMonth } from '@/shared/lib/branchWording.js';

const DAY = 86400000;
const t = (iso) => Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`);

// Both pins' score moves on a shared date axis, with the lag between the first pair bracketed.
// Input is the connect result's comovement detail: { lagDays, moves: { a: [date], b: [date] } }.
// Without dated moves nothing is drawn (the plain pairing line stands in).
export default function JointTrace({ labelA, labelB, detail }) {
  const a = (detail?.moves?.a || []).filter(Boolean);
  const b = (detail?.moves?.b || []).filter(Boolean);
  if (!a.length || !b.length) return null;
  const all = [...a, ...b].map(t);
  const lo = Math.min(...all) - 2 * DAY;
  const hi = Math.max(...all) + 2 * DAY;
  const x = (iso) => `${((t(iso) - lo) / (hi - lo)) * 100}%`;
  const lag = detail.lagDays;
  const days = `${lag} ${lag === 1 ? 'day' : 'days'}`;
  const ticks = [...new Set([...a, ...b].map((d) => String(d).slice(0, 10)))].sort();
  const [from, to] = [a[0], b[0]].sort();
  return (
    <figure className="pn-trace" aria-label={`${labelA} and ${labelB} moved ${days} apart`}>
      {[['a', labelA, a], ['b', labelB, b]].map(([lane, label, dates]) => (
        <div key={lane} className="pn-trace__lane">
          <span className="pn-trace__name">{label}</span>
          <span className="pn-trace__rail">{dates.map((d) => <i key={d} className="pn-trace__mark" style={{ left: x(d) }} />)}</span>
        </div>
      ))}
      <div className="pn-trace__lane">
        <span className="pn-trace__name" />
        <span className="pn-trace__rail pn-trace__rail--axis">
          {from !== to ? <span className="pn-trace__bracket" style={{ left: x(from), right: `calc(100% - ${x(to)})` }}><span>lag: {days}</span></span> : null}
          {ticks.map((d) => <time key={d} className="pn-trace__tick" dateTime={d} style={{ left: x(d) }}>{dayMonth(d)}</time>)}
        </span>
      </div>
    </figure>
  );
}
