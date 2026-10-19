import { useMemo, useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWeeklyArchive } from '@/features/threads';
import { useCountryIntelligence } from '@/features/countries/hooks/useCountryIntelligence';
import { useDisruptionsList } from '@/features/economy';
import { ECONOMY_PARKED } from '@/shared/lib/economyFlag';
import { getTopicRegion } from '@/shared/lib/countryMapping';
import { countryTier, compareByRisk } from '@/features/countries/lib/countryTier';
import { trajectoryOf } from '@/shared/lib/trajectory';
import CountryOverviewMap from '@/features/countries/components/CountryOverviewMap';
import EditorialShell from '@/shared/ui/EditorialShell';
import StatusStrip from '@/shared/ui/StatusStrip';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import TierChip from '@/shared/ui/TierChip.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import StoryRow from '@/shared/ui/StoryRow.jsx';
import Card from '@/shared/ui/Card.jsx';
import Chip from '@/shared/ui/Chip.jsx';
import DirectionArrow from '@/shared/ui/DirectionArrow';
import { isRealCountryName } from '@/shared/lib/placeNames.js';
import SeverityBadge from '@/shared/ui/SeverityBadge';
import '@/features/countries/CountryListPage.css';

const SEVERITY_RANK = { severe: 3, moderate: 2, minor: 1 };
const countryPath = (name) => `/weekly/country/${encodeURIComponent(name)}`;

function Trajectory({ value }) {
  const t = trajectoryOf(value);
  return t ? <DirectionArrow dir={t.dir} /> : null;
}

// ─── Country Card ─────────────────────────────────────────────────────────────

function CountryCard({ country, intel, disruptionSeverity }) {
  return (
    <Card as={Link} to={countryPath(country.name)} className="clp-card">
      <div className="clp-card-head">
        <span className="clp-card-name">{country.name}</span>
        <TierChip tier={countryTier(intel)} score={intel?.riskScore} />
        {disruptionSeverity && <SeverityBadge level={disruptionSeverity} size="sm" />}
        <Trajectory value={intel?.trajectory} />
      </div>

      {intel?.headline && (
        <div className="clp-card-headline">{intel.headline}</div>
      )}

      <div className="clp-card-foot">
        <CategoryTag category={country.topCategories?.[0]} />
        <span className="clp-card-meta">
          {country.articles} art · {country.arcCount} {country.arcCount !== 1 ? 'arcs' : 'arc'}
        </span>
        {intel?.riskSignals?.[0] && (
          <span className="clp-card-signal" title={intel.riskSignals[0]}>
            ⚑ {intel.riskSignals[0].length > 60 ? intel.riskSignals[0].slice(0, 57) + '…' : intel.riskSignals[0]}
          </span>
        )}
      </div>
    </Card>
  );
}

// Risk bands for the briefings grid — the country analog of /weekly's time bands,
// but risk is the meaningful axis (countries are persistent). High = full cards,
// calmer tiers = condensed rows (density decay).
const RISK_BANDS = [
  { tier: 'high', label: 'High risk', word: 'High', cards: true },
  { tier: 'elevated', label: 'Elevated', word: 'Elevated', cards: false },
  { tier: 'moderate', label: 'Moderate', word: 'Moderate', cards: false },
  { tier: 'low', label: 'Low', word: 'Low', cards: false },
];

// ─── Condensed country row (calmer tiers) ─────────────────────────────────────

function CountryRow({ country, intel }) {
  return (
    <StoryRow
      className="clp-row"
      to={countryPath(country.name)}
      title={country.name}
      tier={countryTier(intel)}
      score={intel?.riskScore}
      summary={intel?.headline || null}
      meta={<><Trajectory value={intel?.trajectory} /><span className="clp-row-meta">{country.articles} art</span></>}
    />
  );
}

// ─── Risk band (one tier) ─────────────────────────────────────────────────────

function RiskBand({ band, items, intelligence, maxSeverityByCountry }) {
  if (!items.length) return null;
  return (
    <section className="clp-band">
      <SectionHeader label={band.label} count={items.length} className="clp-band-header" />
      {band.cards ? (
        <div className="clp-cards">
          {items.map(c => (
            <CountryCard
              key={c.name}
              country={c}
              intel={intelligence?.[c.name]}
              disruptionSeverity={maxSeverityByCountry[c.name]}
            />
          ))}
        </div>
      ) : (
        <ul className="clp-rows">
          {items.map(c => <CountryRow key={c.name} country={c} intel={intelligence?.[c.name]} />)}
        </ul>
      )}
    </section>
  );
}

// ─── Left Rail ────────────────────────────────────────────────────────────────

function LeftRail({ sortBy, onSort, searchQuery, onSearch, activeRegion, onRegion, regionCounts }) {
  return (
    <div className="clp-rail-left">
      <div className="clp-rail-section">
        <SectionHeader label="Search" id="clp-search-label" />
        <input
          className="clp-search"
          type="text"
          placeholder="Filter countries…"
          aria-labelledby="clp-search-label"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

      <div className="clp-rail-section">
        <SectionHeader label="Sort" />
        <div className="clp-chips">
          {[['risk', 'Risk level'], ['articles', 'Coverage'], !ECONOMY_PARKED && ['economy', 'Disruption'], ['alpha', 'A → Z']].filter(Boolean).map(([v, label]) => (
            <Chip key={v} selected={sortBy === v} onClick={() => onSort(v)}>{label}</Chip>
          ))}
        </div>
      </div>

      {regionCounts.length > 1 && (
        <div className="clp-rail-section">
          <SectionHeader label="Region" />
          <div className="clp-chips">
            <Chip selected={!activeRegion} onClick={() => onRegion(null)}>All</Chip>
            {regionCounts.map(([r, n]) => (
              <Chip key={r} selected={activeRegion === r} count={n} onClick={() => onRegion(activeRegion === r ? null : r)}>
                {r}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Right Rail: Top-risk + most-covered leaderboards ─────────────────────────

function Leaderboard({ label, items, intelligence, meta }) {
  return (
    <section className="clp-rail-section">
      <SectionHeader label={label} />
      <ol className="clp-leaderboard">
        {items.map((c, i) => {
          const intel = intelligence?.[c.name];
          return (
            <StoryRow
              key={c.name}
              className="clp-lb-row"
              to={countryPath(c.name)}
              title={c.name}
              tier={countryTier(intel)}
              score={intel?.riskScore}
              meta={<><span className="clp-lb-rank">#{i + 1}</span>{meta(c, intel)}</>}
            />
          );
        })}
      </ol>
    </section>
  );
}

function RightRail({ featured, intelligence }) {
  // `featured` is already ranked riskiest first; Most Covered re-ranks the same briefed set by articles.
  const mostCovered = useMemo(() => [...featured].sort((a, b) => b.articles - a.articles).slice(0, 5), [featured]);
  return (
    <div className="clp-rail-right">
      <Leaderboard
        label="Highest Risk"
        items={featured.slice(0, 5)}
        intelligence={intelligence}
        meta={(c, intel) => <Trajectory value={intel?.trajectory} />}
      />
      <Leaderboard
        label="Most Covered"
        items={mostCovered}
        intelligence={intelligence}
        meta={(c) => <span className="clp-lb-count">{c.articles} art</span>}
      />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CountryListPage() {
  const navigate = useNavigate();
  const { dayMap, sortedDates, loading } = useWeeklyArchive();

  const handleCountryClick = useCallback((name) => {
    navigate(countryPath(name));
  }, [navigate]);

  const countries = useMemo(() => {
    if (!dayMap || loading) return [];
    const map = {};
    for (const date of sortedDates) {
      for (const entry of (dayMap[date]?.entries || [])) {
        for (const region of (entry.regions || [])) {
          if (!isRealCountryName(region)) continue; // Batch 3 / F: skip aggregates (Europe, Middle East ...): they are not countries
          if (!map[region]) map[region] = { name: region, articles: 0, threads: new Set(), categories: {} };
          map[region].articles++;
          if (entry.threadId) map[region].threads.add(entry.threadId);
          const cat = (entry.category || 'other').toLowerCase();
          map[region].categories[cat] = (map[region].categories[cat] || 0) + 1;
        }
      }
    }
    return Object.values(map)
      .filter(c => c.articles >= 2)
      .map(c => {
        const sortedCats = Object.entries(c.categories).sort((a, b) => b[1] - a[1]);
        return {
          name: c.name,
          articles: c.articles,
          arcCount: c.threads.size,
          topCategories: sortedCats.slice(0, 2).map(([cat]) => cat),
          region: getTopicRegion({ regions: [c.name] }),
        };
      })
      .sort((a, b) => b.articles - a.articles);
  }, [dayMap, sortedDates, loading]);

  // Request briefings for every country the backend generates one for. The backend
  // caps at MAX_COUNTRIES=20 (newsCountryIntelligence); fetch a small margin over
  // that so ranking drift between the two sides can't strand a real briefing in the
  // "not enough coverage" bucket. Single batched call — no request-burst cost.
  const countryNames = useMemo(() => countries.slice(0, 24).map(c => c.name), [countries]);
  const { intelligence } = useCountryIntelligence(countryNames);
  const { data: allDisruptions = [] } = useDisruptionsList({ limit: 200 }, { enabled: !ECONOMY_PARKED });

  // Map: countryName → max severity from any thread disruption involving that country
  const maxSeverityByCountry = useMemo(() => {
    const map = {};
    for (const d of allDisruptions) {
      const rank = SEVERITY_RANK[d.severity] || 0;
      for (const w of (d.winners || [])) {
        if (w.type !== 'country') continue;
        if (!map[w.name] || rank > SEVERITY_RANK[map[w.name]]) map[w.name] = d.severity;
      }
      for (const l of (d.losers || [])) {
        if (l.type !== 'country') continue;
        if (!map[l.name] || rank > SEVERITY_RANK[map[l.name]]) map[l.name] = d.severity;
      }
    }
    return map;
  }, [allDisruptions]);

  const [activeRegion, setActiveRegion] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('risk');

  // Briefed countries, riskiest first: by riskScore (the number every chip shows), coverage breaks ties.
  const featured = useMemo(() => countries
    .filter(c => intelligence?.[c.name])
    .sort((a, b) => compareByRisk(intelligence[a.name], intelligence[b.name]) || b.articles - a.articles),
  [countries, intelligence]);

  const others = useMemo(() => countries.filter(c => !intelligence?.[c.name]), [countries, intelligence]);

  const regionCounts = useMemo(() => {
    const counts = {};
    for (const c of featured) {
      const r = c.region || 'World';
      counts[r] = (counts[r] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [featured]);

  const latestGeneratedAt = useMemo(() => {
    let latest = null;
    for (const name of Object.keys(intelligence || {})) {
      const gen = intelligence[name]?.generatedAt;
      if (gen && (!latest || gen > latest)) latest = gen;
    }
    return latest;
  }, [intelligence]);

  useEffect(() => { document.title = 'Country Intelligence — Global Perspectives'; }, []);

  if (loading) return <BootLoader variant="inline" label="Loading countries" text="Loading countries" />;

  const q = searchQuery.trim().toLowerCase();

  let filteredFeatured = activeRegion
    ? featured.filter(c => (c.region || 'World') === activeRegion)
    : featured;
  if (q) {
    filteredFeatured = filteredFeatured.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (intelligence?.[c.name]?.headline || '').toLowerCase().includes(q)
    );
  }
  if (sortBy === 'alpha') {
    filteredFeatured = [...filteredFeatured].sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'articles') {
    filteredFeatured = [...filteredFeatured].sort((a, b) => b.articles - a.articles);
  } else if (!ECONOMY_PARKED && sortBy === 'economy') {
    filteredFeatured = [...filteredFeatured].sort((a, b) => {
      const sa = SEVERITY_RANK[maxSeverityByCountry[a.name]] || 0;
      const sb = SEVERITY_RANK[maxSeverityByCountry[b.name]] || 0;
      return sb !== sa ? sb - sa : b.articles - a.articles;
    });
  }

  let filteredOthers = others;
  if (q) filteredOthers = filteredOthers.filter(c => c.name.toLowerCase().includes(q));

  const strip = (
    <StatusStrip
      label="LIVE"
      stats={[
        { value: featured.length, unit: 'briefings' },
        { value: countries.length, unit: 'countries' },
      ]}
      updatedAt={latestGeneratedAt}
    />
  );

  const left = (
    <LeftRail
      sortBy={sortBy}
      onSort={setSortBy}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
      activeRegion={activeRegion}
      onRegion={setActiveRegion}
      regionCounts={regionCounts}
    />
  );

  const right = (
    <RightRail featured={featured} intelligence={intelligence} />
  );

  return (
    <EditorialShell strip={strip} left={left} right={right} className="clp-shell">
      {/* Map: marker size = coverage, ring weight = risk tier (never a colour scale) */}
      <div className="clp-map-wrap">
        <CountryOverviewMap
          countries={countries.map(c => ({
            name: c.name,
            articles: c.articles,
            tier: countryTier(intelligence?.[c.name]),
            headline: intelligence?.[c.name]?.headline || null,
          }))}
          onCountryClick={handleCountryClick}
        />
        <div className="clp-map-legend">
          {RISK_BANDS.map(b => (
            <span key={b.tier} className="clp-leg"><span className={`clp-leg-dot clp-leg-dot--${b.tier}`} /> {b.word}</span>
          ))}
        </div>
      </div>

      {/* AI Briefings — grouped into risk-tier bands (default risk sort); an
          explicit non-risk sort keeps the flat grid so the sort intent is honored. */}
      {filteredFeatured.length > 0 && (
        sortBy === 'risk' ? (
          (() => {
            const byTier = { high: [], elevated: [], moderate: [], low: [] };
            for (const c of filteredFeatured) byTier[countryTier(intelligence?.[c.name]) || 'low'].push(c);
            return RISK_BANDS.map(band => (
              <RiskBand
                key={band.tier}
                band={band}
                items={byTier[band.tier]}
                intelligence={intelligence}
                maxSeverityByCountry={maxSeverityByCountry}
              />
            ));
          })()
        ) : (
          <>
            <SectionHeader label="AI Briefings" hint={`${filteredFeatured.length} countries`} />
            <div className="clp-cards">
              {filteredFeatured.map(c => (
                <CountryCard
                  key={c.name}
                  country={c}
                  intel={intelligence?.[c.name]}
                  disruptionSeverity={maxSeverityByCountry[c.name]}
                />
              ))}
            </div>
          </>
        )
      )}

      {/* Others */}
      {filteredOthers.length > 0 && (
        <section className="clp-others">
          <SectionHeader
            label="Other countries in the news"
            count={filteredOthers.length}
            hint="not enough coverage for AI briefing"
          />
          <div className="clp-others-grid">
            {filteredOthers.map(c => (
              <Link key={c.name} to={countryPath(c.name)} className="clp-others-item">
                <span className="clp-others-name">{c.name}</span>
                <span className="clp-others-count">{c.articles}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </EditorialShell>
  );
}
