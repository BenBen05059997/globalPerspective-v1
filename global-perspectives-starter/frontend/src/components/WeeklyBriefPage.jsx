import { Link } from 'react-router-dom';
import { useWeeklyBrief } from '../hooks/useWeeklyBrief';
import Markdown from './Markdown';
import './WeeklyBriefPage.css';

const RISK_COLOR = { low: '#4fa07b', moderate: '#caa23a', elevated: '#d89540', high: '#c94a33' };

function formatWeekOf(weekKey) {
  if (!weekKey) return '';
  const d = new Date(weekKey + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return weekKey;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function SignalChip({ kind, level }) {
  // Honest semantics: a color-coded RISK chip only for genuine threats; a neutral
  // "DEVELOPMENT" chip for cooperative/non-threat stories (so a climate framework isn't
  // shown as a red "elevated risk").
  if (kind === 'development') {
    return (
      <span className="wb-chip" style={{ color: '#6a6a6e', borderColor: '#6a6a6e33', background: '#6a6a6e12' }}>
        <span className="wb-chip-dot" style={{ background: '#6a6a6e' }} />
        DEVELOPMENT
      </span>
    );
  }
  const c = RISK_COLOR[level] || '#6a6a6e';
  return (
    <span className="wb-chip" style={{ color: c, borderColor: `${c}33`, background: `${c}14` }}>
      <span className="wb-chip-dot" style={{ background: c }} />
      {(level || 'n/a').toUpperCase()} RISK
    </span>
  );
}

function sourceOutlets(sources) {
  const seen = new Set();
  const out = [];
  for (const s of sources || []) {
    const o = (s.source || s.title || '').replace(/^www\./, '');
    if (s.url && o && !seen.has(o)) { seen.add(o); out.push({ outlet: o, url: s.url }); }
  }
  return out;
}

function SignalCard({ s }) {
  const outlets = sourceOutlets(s.sources);
  return (
    <div className="wb-sig">
      <div className="wb-sig-top">
        {s.threadId ? (
          <Link className="wb-sig-lede wb-sig-lede-link" to={`/weekly/thread/${s.threadId}`}>{s.lede}</Link>
        ) : (
          <div className="wb-sig-lede">{s.lede}</div>
        )}
        <SignalChip kind={s.kind} level={s.riskLevel} />
      </div>
      <div className="wb-sig-meta">{s.region || '—'} <span className="wb-dot">·</span> as of {s.asOf || '—'}</div>
      <p className="wb-sig-fact">{s.fact}</p>
      {s.soWhat && <p className="wb-sig-sw"><span>So what</span> {s.soWhat}</p>}
      {(outlets.length > 0 || s.related || s.threadId) && (
        <div className="wb-sig-src">
          {s.threadId && (
            <Link className="wb-sig-arc" to={`/weekly/thread/${s.threadId}`}>Full story arc →</Link>
          )}
          {outlets.length > 0 && (
            <>{s.threadId && <span className="wb-dot">·</span>} <span className="wb-src-label">Sources:</span> {outlets.map((o, i) => (
              <span key={o.outlet}>
                {i > 0 && <span className="wb-dot">·</span>}
                <a href={o.url} target="_blank" rel="noopener noreferrer">{o.outlet}</a>
              </span>
            ))}</>
          )}
          {s.related && <> <span className="wb-dot">·</span> <span className="wb-rel">Related: {s.related}</span></>}
        </div>
      )}
    </div>
  );
}

export default function WeeklyBriefPage() {
  const { brief, loading, error } = useWeeklyBrief();
  const signals = brief && Array.isArray(brief.signals) ? brief.signals : null;
  const watch = brief && Array.isArray(brief.watch) ? brief.watch : [];
  // Risk KPIs count THREAT signals only (a cooperative "development" isn't a risk).
  const threats = signals ? signals.filter((s) => s.kind !== 'development') : [];
  const highRisk = threats.filter((s) => s.riskLevel === 'high').length;
  const highest = threats.length ? threats[0].riskLevel : null;

  return (
    <div className="wb-page">
      <div className="wb-wrap">
        <div className="wb-eyebrow">Weekly Signals Brief</div>

        {loading ? (
          <p className="wb-status">Loading the latest brief…</p>
        ) : error ? (
          <p className="wb-status">Couldn’t load the brief right now. Please try again shortly.</p>
        ) : !brief ? (
          <div className="wb-empty">
            <h1 className="wb-h1">No brief published yet</h1>
            <p className="wb-status">The weekly signals brief will appear here once it’s published.</p>
          </div>
        ) : signals ? (
          <>
            <div className="wb-dateline">
              WEEK OF {formatWeekOf(brief.weekOf).toUpperCase()}
              {brief.asOf && <> · COMPILED {brief.asOf}</>} · {signals.length} SIGNALS
            </div>
            <h1 className="wb-h1">The week’s signals, ranked by risk</h1>

            <div className="wb-kpis">
              <div className="wb-kpi"><div className="wb-kpi-n">{signals.length}</div><div className="wb-kpi-l">Signals tracked</div></div>
              <div className="wb-kpi"><div className="wb-kpi-n">{(highest || '—').toUpperCase()}</div><div className="wb-kpi-l">Highest risk</div></div>
              <div className="wb-kpi"><div className="wb-kpi-n">{highRisk}</div><div className="wb-kpi-l">At high risk</div></div>
              <div className="wb-kpi"><div className="wb-kpi-n">{watch.length}</div><div className="wb-kpi-l">To watch</div></div>
            </div>

            <div className="wb-sec">Signals this week</div>
            {signals.map((s) => <SignalCard key={s.threadId} s={s} />)}

            {watch.length > 0 && (
              <>
                <div className="wb-sec wb-sec-watch">What to watch</div>
                <div className="wb-watch">
                  {watch.map((w, i) => (
                    <div className="wb-w-row" key={i}>
                      <div className="wb-w-ev">{w.event}{w.date && <span className="wb-w-date">{w.date}</span>}</div>
                      {w.stake && <div className="wb-w-stake">{w.stake}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="wb-foot">
              Signals are selected by significance (coverage + risk). Risk level, sources, and dates are computed from our pipeline data; the one-line “so what” is an editorial assessment, not a prediction. We don’t assert connections between signals unless noted. Each signal links its underlying sources.
            </div>
          </>
        ) : (
          // Backward-compatible: an older prose-format brief, if one was ever published.
          <>
            <h1 className="wb-h1">{brief.headline}</h1>
            {brief.dek && <p className="wb-dek">{brief.dek}</p>}
            <Markdown text={brief.brief} className="gp-md wb-body" />
          </>
        )}
      </div>
    </div>
  );
}
