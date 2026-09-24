// StatusStrip — mono "LIVE · N threads · updated Xm ago" bar used at top of editorial pages.
// Props:
//   label:       left-side all-caps label (default: "LIVE")
//   stats:       array of { value, unit } pairs rendered as  N unit  segments
//   updatedAt:   ISO string or ms timestamp for "updated Xm ago" badge

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
  return (
    <div className="ss-strip">
      <span className="ss-label">{label}</span>
      {stats.map((s, i) => (
        <span key={i} className="ss-stat">
          <span className="ss-val">{s.value}</span>
          <span className="ss-unit">{s.unit}</span>
        </span>
      ))}
      {ago && <span className="ss-ago">updated {ago}</span>}
    </div>
  );
}
