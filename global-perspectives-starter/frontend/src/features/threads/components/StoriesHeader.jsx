import { Link } from 'react-router';
import Tabs from '@/shared/ui/Tabs.jsx';
import { ROUTE } from '@/shared/lib/links.js';

// StoriesHeader — the top of /weekly: Stories | Countries (a plain link to the countries page), a one-line count of open stories by
// tier (computed from the loaded archive, never typed: scored tiers first, then a dim "N not yet
// scored"), and the view switch (List | Board | Timeline | Map | Web). Phone (<900px) swaps it for READ / MAP /
// TIMELINE tabs (READ default; the changed-since-last-visit section lives inside READ, and READ carries a
// List | Board | Web toggle).
const TIER_WORD = { high: 'High', elevated: 'Elevated', moderate: 'Moderate', low: 'Low' };
const SCORED = ['high', 'elevated', 'moderate', 'low'];

const DESKTOP_VIEWS = [
  { key: 'list', label: 'List' },
  { key: 'board', label: 'Board' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'map', label: 'Map' },
  { key: 'web', label: 'Web' },
];
const PHONE_TABS = [
  { key: 'read', label: 'Read' },
  { key: 'map', label: 'Map' },
  { key: 'timeline', label: 'Timeline' },
];

// READ's own List | Board | Web toggle (phone): Board and Web are reachable without a fourth tab (P1 keeps READ / MAP / TIMELINE).
const READ_VIEWS = [
  { key: 'list', label: 'List' },
  { key: 'board', label: 'Board' },
  { key: 'web', label: 'Web' },
];

// `?view=changes` is the old CHANGES tab: it now opens READ (scrolled to the changed section).
// `?view=board` and `?view=web` are also READ (the board and the story web are ways of reading the list).
function viewToTab(view) {
  return view === 'map' ? 'map' : view === 'timeline' ? 'timeline' : 'read';
}

export default function StoriesHeader({ view, setView, isPhone, counts = null }) {
  const shownView = view === 'changes' ? 'list' : view; // the old CHANGES view is the list
  return (
    <header className="sf-head">
      <div className="sf-head__row">
        <nav className="gp-tabs gp-tabs--line wp-section-tabs" aria-label="Stories or countries">
          <span className="gp-tabs__tab" aria-current="page">Stories</span>
          <Link className="gp-tabs__tab wp-countries-link" to={ROUTE.countries}>Countries</Link>
        </nav>

        {!isPhone ? (
          <Tabs variant="segmented" idBase="sf-view" label="View" tabs={DESKTOP_VIEWS} active={shownView} onChange={setView} className="sf-seg" />
        ) : null}
      </div>

      {counts && counts.total > 0 ? (
        <p className="sf-counts" aria-label="Open stories by tier">
          <strong>{counts.total}</strong> open {counts.total === 1 ? 'story' : 'stories'}
          <span className="sf-counts__win"> · last 30 days</span>
          {SCORED.filter((t) => counts[t] > 0).map((t) => (
            <span key={t} className="sf-counts__t">
              {TIER_WORD[t]} <b>{counts[t]}</b>
            </span>
          ))}
          {counts.none > 0 ? <span className="sf-counts__unscored">{counts.none} not yet scored</span> : null}
        </p>
      ) : null}

      {isPhone ? (
        <Tabs
          variant="phone" idBase="sf-tab" label="Stories view" tabs={PHONE_TABS} active={viewToTab(view)}
          onChange={(t) => setView(t === 'read' ? 'list' : t)} className="sf-tabs"
        />
      ) : null}

      {isPhone && viewToTab(view) === 'read' ? (
        <Tabs variant="segmented" idBase="sf-read" label="Read as" tabs={READ_VIEWS} active={shownView} onChange={setView} className="sf-subtoggle" />
      ) : null}
    </header>
  );
}
