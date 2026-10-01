import FilterGroup from '@/shared/ui/FilterGroup.jsx';
import { CRISIS_LABEL } from '@/shared/lib/crisisHue';
import { CRISIS_TYPES, WINDOWS, SORTS } from '@/features/threads/lib/storyGroups';

// StoriesFilters — the left-rail / phone-panel filter set: search, crisis type x4, tier, window,
// region, sort. Built on the shared FilterGroup (real inputs, 44px rows). Topic categories are not
// a colour filter any more; only a deep-linked ?category= shows here, as a removable chip.
const TIER_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'elevated', label: 'Elevated' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'low', label: 'Low' },
  { value: 'none', label: 'Not scored' },
];

export default function StoriesFilters({
  q, setQ, crisis, setCrisis, tiers, setTiers, windowValue, setWindow, region, setRegion, sort, setSort,
  category = null, clearCategory = null, counts, regions, showSearch = true,
}) {
  return (
    <div className="sf-filters">
      {showSearch ? (
      <label className="sf-search-wrap">
        <span className="gp-filter__legend">Search</span>
        <input
          type="search"
          className="sf-search"
          placeholder="Search stories…"
          aria-label="Search stories"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      ) : null}

      {category ? (
        <div className="sf-topic">
          <span className="gp-filter__legend">Topic</span>
          <button type="button" className="sf-chip" onClick={clearCategory} aria-label={`Clear topic filter ${category}`}>
            {category} <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : null}

      <FilterGroup
        label="Crisis type"
        name="sf-crisis"
        type="checkbox"
        value={crisis}
        onChange={setCrisis}
        options={CRISIS_TYPES.map((c) => ({
          value: c,
          count: counts.crisis[c],
          label: (
            <span className="sf-crisis-opt">
              <span className="sf-dot" style={{ background: `var(--hue-${c})` }} aria-hidden="true" />
              {CRISIS_LABEL[c]}
            </span>
          ),
        }))}
      />

      <FilterGroup
        label="Tier"
        name="sf-tier"
        type="checkbox"
        value={tiers}
        onChange={setTiers}
        options={TIER_OPTIONS.map((o) => ({ ...o, count: counts.tier[o.value] }))}
      />

      <FilterGroup
        label="Window"
        name="sf-window"
        type="radio"
        value={windowValue}
        onChange={setWindow}
        options={WINDOWS.map((w) => ({ value: w.value, label: w.label }))}
      />

      {regions.length > 1 ? (
        <FilterGroup
          label="Region"
          name="sf-region"
          type="radio"
          value={region || ''}
          onChange={(v) => setRegion(v || null)}
          options={[{ value: '', label: 'All', count: counts.total }, ...regions.map((r) => ({ value: r.region, label: r.region, count: r.count }))]}
        />
      ) : null}

      <FilterGroup
        label="Sort"
        name="sf-sort"
        type="radio"
        value={sort}
        onChange={setSort}
        options={SORTS}
      />
    </div>
  );
}
