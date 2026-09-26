import { Link } from 'react-router-dom';
import { tierFromScore, tierLabel } from '@/shared/lib/riskTiers';
import { WIDTH, HEIGHT, WORLD_PATH, centroidForCountry } from '@/features/account/lib/deskMap';

// FOLLOWING (K1 board, right column top) — a small honest-geography map (real coastlines,
// see lib/deskMap.js) plus a chip per followed country. Unfollowing stays on the country page
// (no new follow control here). Hue is fixed cyan: it never encodes risk (that's the chip text).
export default function DeskFollowing({ isMember, followedCountries, countryResults }) {
  if (!isMember) {
    return (
      <section className="desk-panel desk-following">
        <div className="desk-kicker">FOLLOWING</div>
        <p className="desk-empty">Following countries is part of membership.</p>
      </section>
    );
  }

  if (!followedCountries || followedCountries.length === 0) {
    return (
      <section className="desk-panel desk-following">
        <div className="desk-kicker">FOLLOWING</div>
        <p className="desk-empty">You don't follow any country yet.</p>
      </section>
    );
  }

  const rows = followedCountries.map((country) => {
    const result = countryResults.find((r) => r.country === country);
    const sorted = Array.isArray(result?.snapshots)
      ? [...result.snapshots].sort((a, b) => String(a.dateKey || '').localeCompare(String(b.dateKey || '')))
      : [];
    const latest = sorted[sorted.length - 1] || null;
    const score = latest?.riskScore != null ? Number(latest.riskScore) : null;
    const tier = Number.isFinite(score) ? tierFromScore(score) : null;
    const centroid = centroidForCountry(country);
    return { country, score, tier, centroid };
  });

  return (
    <section className="desk-panel desk-following">
      <div className="desk-kicker">FOLLOWING</div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="desk-following-map"
        role="img"
        aria-label="Small world map with followed countries outlined"
      >
        <path d={WORLD_PATH} className="desk-following-land" />
        {rows.filter((r) => r.centroid).map((r) => (
          <circle key={r.country} cx={r.centroid[0]} cy={r.centroid[1]} r={7} className="desk-following-dot" />
        ))}
      </svg>
      <div className="desk-following-chips">
        {rows.map((r) => (
          <Link key={r.country} to={`/weekly/country/${encodeURIComponent(r.country)}`} className="desk-following-chip">
            🔔 {r.country}
            {r.score != null ? ` · risk ${r.score} · ${tierLabel(r.tier).toLowerCase()}` : ''}
          </Link>
        ))}
      </div>
    </section>
  );
}
