import { TIER_FILTERS } from '@/features/threads/lib/storyGroups';

// StoriesHeader — the top of /weekly: Stories | Countries tabs, a one-line count of open stories by
// tier (computed from the loaded archive, never typed), and the view switch. Phone (<900px) swaps
// the view switch for READ / MAP / CHANGES tabs; Timeline stays reachable from READ.
const TIER_WORD = { high: 'High', elevated: 'Elevated', moderate: 'Moderate', low: 'Low', none: 'Not scored' };

export const DESKTOP_VIEWS = [
  { value: 'list', label: 'List' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'map', label: 'Map' },
];
export const PHONE_TABS = [
  { value: 'read', label: 'Read' },
  { value: 'map', label: 'Map' },
  { value: 'changes', label: 'Changes' },
];

export function viewToTab(view) {
  return view === 'map' ? 'map' : view === 'changes' ? 'changes' : 'read';
}

export default function StoriesHeader({ pageTab, setPageTab, view, setView, isPhone, counts = null }) {
  return (
    <header className="sf-head">
      <div className="sf-head__row">
        <div className="wp-section-tabs" role="tablist" aria-label="Stories or countries">
          {['stories', 'countries'].map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={pageTab === tab}
              className={`wp-section-tab ${pageTab === tab ? 'active' : ''}`}
              onClick={() => setPageTab(tab)}
            >
              {tab === 'stories' ? 'Stories' : 'Countries'}
            </button>
          ))}
        </div>

        {pageTab === 'stories' && !isPhone ? (
          <div className="sf-seg" role="group" aria-label="View">
            {DESKTOP_VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                className="sf-seg__btn"
                aria-pressed={view === v.value || (v.value === 'list' && view === 'changes')}
                onClick={() => setView(v.value)}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {pageTab === 'stories' && counts && counts.total > 0 ? (
        <p className="sf-counts" aria-label="Open stories by tier">
          <strong>{counts.total}</strong> open {counts.total === 1 ? 'story' : 'stories'}
          <span className="sf-counts__win"> · last 30 days</span>
          {TIER_FILTERS.filter((t) => counts[t] > 0).map((t) => (
            <span key={t} className={`sf-counts__t sf-counts__t--${t}`}>
              {TIER_WORD[t]} <b>{counts[t]}</b>
            </span>
          ))}
        </p>
      ) : null}

      {pageTab === 'stories' && isPhone ? (
        <div className="sf-tabs" role="tablist" aria-label="Stories view">
          {PHONE_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={viewToTab(view) === t.value}
              className="sf-tabs__btn"
              onClick={() => setView(t.value === 'read' ? (view === 'timeline' ? 'timeline' : 'list') : t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
    </header>
  );
}
