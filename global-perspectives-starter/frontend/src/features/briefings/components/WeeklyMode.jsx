import { useEffect } from 'react';
import { Link } from 'react-router';
import { useWeeklyBrief } from '@/features/briefings/hooks/useWeeklyBrief.js';
import SubscribeCard from '@/shared/ui/SubscribeCard';
import TierChip from '@/shared/ui/TierChip.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import Card from '@/shared/ui/Card.jsx';
import StoryLink from '@/shared/ui/StoryLink.jsx';
import { SaveButton } from '@/shared/ui/SaveButton';
import { tierFromLevel } from '@/shared/lib/riskTiers';
import { formatDateLabel } from '@/shared/lib/dateUtils';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import { WeeklyEditionNav } from '@/features/briefings/components/EditionsStrip.jsx';
import BriefingError from '@/features/briefings/components/BriefingError.jsx';
import { briefingHref } from '@/shared/lib/links.js';
import { previousWeekKey } from '@/features/briefings/lib/editions.js';
import { threadIdOf, placeNames } from '@/features/briefings/lib/briefingSlides.js';
import PlaceLinks from '@/features/briefings/components/PlaceLinks.jsx';
import '@/features/briefings/components/WeeklyMode.css';

function SignalChip({ kind, level }) {
  // A TierChip only for genuine threats; a neutral "Development" chip for cooperative stories
  // (a climate framework is not an elevated risk). An unknown level reads "Not scored".
  if (kind === 'development') return <span className="wb-chip">Development</span>;
  return <TierChip className="wb-sig-chip" tier={tierFromLevel(level)} />;
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

// "Related" is the lede of another signal of the week (newsWeeklyBrief linkRelated); it links to that
// signal's story when one of this week's signals carries both that lede and a real thread id.
function relatedThreadId(s, signals) {
  if (!s.related || !Array.isArray(s.relatedThreadIds)) return null;
  const o = signals.find((x) => x !== s && x.lede === s.related && s.relatedThreadIds.includes(x.threadId));
  return o ? threadIdOf(o) : null;
}

function SignalCard({ s, signals }) {
  const outlets = sourceOutlets(s.sources);
  const threadId = threadIdOf(s);
  const places = placeNames(s);
  const topic = { title: s.lede, regions: places.length ? places : undefined };
  return (
    <Card as="article" className="wb-sig">
      <div className="wb-sig-top">
        {threadId ? (
          <StoryLink className="wb-sig-lede wb-sig-lede-link" threadId={threadId} topic={topic} asOf={s.asOf}>{s.lede}</StoryLink>
        ) : (
          <div className="wb-sig-lede">{s.lede}</div>
        )}
        <SignalChip kind={s.kind} level={s.riskLevel} />
      </div>
      <div className="wb-sig-meta">{places.length ? <PlaceLinks names={places} sep=" · " /> : '—'} <span className="wb-dot">·</span> as of {s.asOf || '—'}</div>
      <p className="wb-sig-fact">{s.fact}</p>
      {s.soWhat && <p className="wb-sig-sw"><span>So what</span> {s.soWhat}</p>}
      {(outlets.length > 0 || s.related || threadId) && (
        <div className="wb-sig-src">
          {threadId && (
            <StoryLink className="wb-sig-arc" threadId={threadId} topic={topic} asOf={s.asOf}>Full story arc →</StoryLink>
          )}
          {outlets.length > 0 && (
            <>{threadId && <span className="wb-dot">·</span>} <span className="wb-src-label">Sources:</span> {outlets.map((o, i) => (
              <span key={o.outlet}>
                {i > 0 && <span className="wb-dot">·</span>}
                <a href={o.url} target="_blank" rel="noopener noreferrer">{o.outlet}</a>
              </span>
            ))}</>
          )}
          {s.related && <> <span className="wb-dot">·</span> <span className="wb-rel">Related: {relatedThreadId(s, signals)
            ? <StoryLink threadId={relatedThreadId(s, signals)} topic={{ title: s.related }}>{s.related}</StoryLink>
            : s.related}</span></>}
        </div>
      )}
    </Card>
  );
}

const weekHref = (week) => briefingHref({ mode: 'weekly', week });

// WeeklyMode — /briefings?mode=weekly: the weekly signals brief as a long-form read. `?week=`
// asks for a past edition (see WeeklyEditionNav for how an unsupported lookup is shown).
export default function WeeklyMode({ weekParam }) {
  const { brief, loading, error, refetch } = useWeeklyBrief(weekParam);

  useEffect(() => {
    document.title = brief?.weekOf
      ? `Weekly Brief — week of ${formatDateLabel(brief.weekOf)} | Global Perspectives`
      : 'Weekly Brief | Global Perspectives';
  }, [brief]);

  if (loading) return <BootLoader variant="inline" label="Loading the weekly brief" text="Loading the weekly brief" />;
  if (error && !brief) return <BriefingError what="weekly" error={error} onRetry={refetch} />;

  const signals = Array.isArray(brief?.signals) ? brief.signals : [];
  if (!signals.length) {
    // No edition, or an early prose-format edition without signals (not shown here).
    let title = 'No brief published yet';
    let text = 'The weekly signals brief will appear here once it’s published.';
    if (brief?.weekOf) {
      title = `Week of ${formatDateLabel(brief.weekOf)}`;
      text = 'This edition predates the signals format and has no signals to show.';
    } else if (weekParam) {
      title = `No weekly brief for the week of ${formatDateLabel(weekParam)}`;
      text = 'No edition was published under that week.';
    }
    return (
      <div className="wb-page">
        <div className="wb-wrap wb-empty">
          {brief?.weekOf && <WeeklyEditionNav weekOf={brief.weekOf} requestedWeek={weekParam} hrefForWeek={weekHref} />}
          <h1 className="wb-h1">{title}</h1>
          <p className="wb-status">{text}</p>
          {weekParam && !brief?.weekOf && (
            <p className="wb-empty-links">
              <Link className="wb-latest" to={weekHref(previousWeekKey(weekParam))}>← Week before</Link>
              <Link className="wb-latest" to={weekHref(null)}>Latest edition →</Link>
            </p>
          )}
        </div>
      </div>
    );
  }

  const watch = Array.isArray(brief.watch) ? brief.watch : [];
  // Risk KPIs count THREAT signals only (a cooperative "development" isn't a risk).
  const threats = signals.filter((s) => s.kind !== 'development');
  const highRisk = threats.filter((s) => s.riskLevel === 'high').length;
  const highest = threats.length ? tierFromLevel(threats[0].riskLevel) : null;
  const weekLabel = formatDateLabel(brief.weekOf);

  return (
    <div className="wb-page">
      <div className="wb-wrap">
        <WeeklyEditionNav weekOf={brief.weekOf} requestedWeek={weekParam} hrefForWeek={weekHref} />
        <div className="wb-head">
          <div>
            <div className="wb-eyebrow">Weekly Signals Brief</div>
            <div className="wb-dateline">
              WEEK OF {weekLabel.toUpperCase()}
              {brief.asOf && <> · COMPILED {brief.asOf}</>} · {signals.length} SIGNALS
            </div>
          </div>
          <SaveButton itemType="weekly" itemId={brief.weekOf} metadata={{ headline: 'Weekly Signals Brief', date: `Week of ${weekLabel}` }} />
        </div>
        <h1 className="wb-h1">The week’s signals, ranked by risk</h1>

        <div className="wb-kpis">
          <Card pad="sm"><div className="wb-kpi-n">{signals.length}</div><div className="wb-kpi-l">Signals tracked</div></Card>
          <Card pad="sm"><div className="wb-kpi-n wb-kpi-n--chip">{highest ? <TierChip tier={highest} /> : '—'}</div><div className="wb-kpi-l">Highest risk</div></Card>
          <Card pad="sm"><div className="wb-kpi-n">{highRisk}</div><div className="wb-kpi-l">At high risk</div></Card>
          <Card pad="sm"><div className="wb-kpi-n">{watch.length}</div><div className="wb-kpi-l">To watch</div></Card>
        </div>

        <SubscribeCard variant="weekly" />

        <SectionHeader label="Signals this week" count={signals.length} />
        {signals.map((s, i) => <SignalCard key={s.threadId || i} s={s} signals={signals} />)}

        {watch.length > 0 && (
          <>
            <SectionHeader className="wb-sec-watch" label="What to watch" count={watch.length} />
            <Card pad="none" className="wb-watch">
              {watch.map((w, i) => (
                <div className="wb-w-row" key={i}>
                  <div className="wb-w-ev">{w.event}{w.date && <span className="wb-w-date">{w.date}</span>}</div>
                  {w.stake && <div className="wb-w-stake">{w.stake}</div>}
                </div>
              ))}
            </Card>
          </>
        )}

        <div className="wb-foot">
          Signals are selected by significance (coverage + risk). Risk level, sources, and dates are computed from our pipeline data; the one-line “so what” is an editorial assessment, not a prediction. We don’t assert connections between signals unless noted. Each signal links its underlying sources.
        </div>
      </div>
    </div>
  );
}
