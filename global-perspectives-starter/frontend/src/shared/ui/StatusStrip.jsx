// StatusStrip — mono "LIVE · N threads · updated Xm ago" bar used at top of editorial pages.
// Props:
//   label:       left-side all-caps label (default: "LIVE" — only shown when data is fresh, see
//                STALE_THRESHOLD_MS below; a caller-supplied non-"LIVE" label always wins)
//   stats:       array of { value, unit } pairs rendered as  N unit  segments
//   updatedAt:   ISO string or ms timestamp for "updated Xm ago" badge

// Freshness cutoff for the "LIVE" chip: the topics/news pipeline that feeds most StatusStrip
// callers runs on a 4-hourly cadence (InvokeGoogleGemini/InvokeNewsAgent, ARCHITECTURE.md
// "Lambda #1/#2"), so a strip is still describing genuinely fresh data up to roughly one missed
// cycle later. Named constant so the threshold is a one-line follow-up to tune, per
// STAGE0_FIXES_PLAN.md item (b).
export const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours

function timeAgo(ts) {
  if (!ts) return null;
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function StatusStrip({ label = 'LIVE', stats = [], updatedAt }) {
  const ago = timeAgo(updatedAt);
  // Only ever claim "LIVE" when we actually know the data is fresh. If the caller passed an
  // explicit non-default label, respect it unconditionally (some callers may want a different
  // fixed label regardless of age). If the default "LIVE" is in effect but `updatedAt` is
  // missing or older than the threshold, drop the freshness claim rather than asserting it.
  const isDefaultLive = label === 'LIVE';
  const isFresh = updatedAt != null && (Date.now() - new Date(updatedAt).getTime()) < STALE_THRESHOLD_MS;
  const effectiveLabel = isDefaultLive ? (isFresh ? 'LIVE' : null) : label;
  return (
    <div className="ss-strip">
      {effectiveLabel && <span className="ss-label">{effectiveLabel}</span>}
      {stats.map((s, i) => (
        <span key={i} className="ss-stat">
          <span className="ss-val">{s.value}</span>
          <span className="ss-unit">{s.unit}</span>
        </span>
      ))}
      {ago && <span className="ss-ago">{isDefaultLive && !isFresh ? 'Last updated ' : 'updated '}{ago}</span>}
    </div>
  );
}
