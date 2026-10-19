import { asOfParts } from '@/shared/lib/age.js';
import '@/shared/ui/blocks.css';

// AsOf — the one freshness line on every page: "as of 5h ago (19 Oct 2026)" read from the object's own
// timestamp, plus an optional source label (the job that made it, e.g. "story analysis"). Renders nothing
// without a real timestamp (never a guessed date). The full timestamp is the hover title.
//   generatedAt  ISO timestamp of the object shown
//   source       optional label of the job / feed that produced it
//   now          injectable clock (tests)
export default function AsOf({ generatedAt, source, now, className }) {
  const t = asOfParts(generatedAt, now);
  if (!t) return null;
  return (
    <span className={['gp-asof', className].filter(Boolean).join(' ')}>
      <time dateTime={t.iso} title={new Date(t.iso).toLocaleString()}>{t.text}</time>
      {source ? <span className="gp-asof__source"> · {source}</span> : null}
    </span>
  );
}
