// MapAbout — "How we read the world" + the "Elsewhere" teasers + the active-situations index. On
// phones this still sits below the map (the page scrolls there); on the desktop full-bleed console
// (R4a) the map is the whole page, so the same content opens from a small "About this map" control
// as a drawer instead — nothing was dropped, it moved. Every date is computed by the caller.
// The "?" page (SPEC §5) puts the site first: the promise sentence (decision 0064), the three kinds, the leave-out line and what
// each tab holds; then "Read today's stories →", which keeps /today reachable from the map (decision 0029) beside the Today tab.
import { Link } from 'react-router';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import { TIER_LABEL, iso3Name } from '@/shared/lib/situationLabels.js';
import { AXES, AXIS_LABELS } from '@/shared/lib/riskTiers.js';
import { ROUTE, briefingHref, todayHref } from '@/shared/lib/links.js';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import ReaderPromise from '@/shared/ui/ReaderPromise.jsx';
import SiteGuide from '@/shared/ui/SiteGuide.jsx';
import HowWeRead from '@/shared/ui/HowWeRead.jsx';


// The first three affected countries, each linked to its country page.
function AffectedNames({ codes }) {
  const shown = (codes || []).slice(0, 3);
  return shown.map((c, i) => (
    <span key={c}>{i ? ', ' : ' · '}<EntityLink kind="country" id={c}>{iso3Name(c)}</EntityLink></span>
  ));
}

export default function MapAbout({
  paused, latestDailyEditionLabel, latestWeeklyEditionLabel, ranked = [], onSelect, coverageNote = null,
}) {
  return (
    <>
      <div className="sh-fold-site">
        <ReaderPromise />
        <SiteGuide />
      </div>
      <p><Link to={todayHref()}>Read today’s stories →</Link></p>
      <HowWeRead paused={paused} coverageNote={coverageNote} />

      <p className="sh-dim sh-imagery">Globe imagery: Earth at night, NASA Black Marble.</p>

      <div className="sh-fold-teasers">
        <SectionHeader as="h3" label="Elsewhere on Global Perspectives" />
        <div className="sh-teasers">
          <Link to={briefingHref({ mode: 'read' })}><b>Daily Brief</b><span>
            {latestDailyEditionLabel ? `Latest edition ${latestDailyEditionLabel}` : 'The day’s developments, gathered and synthesised'}
            {paused ? ' — analysis paused.' : '.'}
          </span></Link>
          <Link to={briefingHref({ mode: 'weekly' })}><b>Weekly</b><span>
            {latestWeeklyEditionLabel ? `Latest edition ${latestWeeklyEditionLabel}, with the reasoning shown.` : 'A long synthesis, with the reasoning shown.'}
          </span></Link>
          <Link to={ROUTE.trackRecord}><b>Track Record</b><span>Every forecast scored against what happened, including the misses.</span></Link>
        </div>
      </div>

      {ranked.length ? (
        <div className="sh-fold-index">
          <SectionHeader as="h3" label="Active situations" count={`${ranked.length} open`} />
          {AXES.map((a) => {
            const items = ranked.filter((s) => s.axis === a);
            if (!items.length) return null;
            return (
              <div key={a} className="sh-idx-group">
                <h5><span className="sh-leg-dot" style={{ background: `var(--hue-${a})` }} />{AXIS_LABELS[a]} · {items.length}</h5>
                <ul>
                  {items.map((s) => (
                    <li key={s.id}>
                      <button className="sh-idx-link" onClick={() => onSelect && onSelect(s.id)}>{s.verb_label}</button>
                      <span className="sh-dim"> — {TIER_LABEL[s.tier]}{s.escalating ? ' · ▲ getting worse' : ''}<AffectedNames codes={s.iso3_affected} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
