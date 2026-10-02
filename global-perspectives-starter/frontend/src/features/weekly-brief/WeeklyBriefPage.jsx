import { useEffect } from 'react';
import { useWeeklyBrief } from '@/features/weekly-brief/hooks/useWeeklyBrief';
import Markdown from '@/shared/ui/Markdown';
import SubscribeCard from '@/features/account/components/SubscribeCard';
import TierChip from '@/shared/ui/TierChip.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import '@/features/weekly-brief/WeeklyBriefPage.css';
import StoryLink from '@/shared/ui/StoryLink.jsx';

function formatWeekOf(weekKey) {
  if (!weekKey) return '';
  const d = new Date(weekKey + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return weekKey;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function SignalChip({ kind, level }) {
  // Honest semantics: a TierChip (tier word + ring weight) only for genuine threats; a neutral
  // "Development" chip for cooperative/non-threat stories (so a climate framework isn't shown as
  // an elevated risk). An unknown level reads "Not scored" rather than claiming a tier.
  if (kind === 'development') return <span className="wb-chip">Development</span>;
  return <TierChip className="wb-sig-chip" tier={level} />;
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
          <StoryLink className="wb-sig-lede wb-sig-lede-link" threadId={s.threadId} topic={{ title: s.lede, regions: s.region ? [s.region] : undefined }} asOf={s.asOf}>{s.lede}</StoryLink>
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
            <StoryLink className="wb-sig-arc" threadId={s.threadId} topic={{ title: s.lede, regions: s.region ? [s.region] : undefined }} asOf={s.asOf}>Full story arc →</StoryLink>
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
  useEffect(() => { document.title = 'Weekly Brief | Global Perspectives'; }, []);
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
          <BootLoader variant="inline" label="Loading the latest brief" text="Loading the latest brief" />
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

            <SubscribeCard variant="weekly" />

            <SectionHeader label="Signals this week" count={signals.length} />
            {signals.map((s) => <SignalCard key={s.threadId} s={s} />)}

            {watch.length > 0 && (
              <>
                <SectionHeader className="wb-sec-watch" label="What to watch" count={watch.length} />
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
