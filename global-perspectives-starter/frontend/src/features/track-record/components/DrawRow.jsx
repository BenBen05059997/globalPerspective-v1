import { useMemo, useState } from 'react';
import { verifyDraw } from '@/features/track-record/lib/sampleRule.js';
import { fmtDay } from '@/features/track-record/lib/trFormatDate.js';
import '@/features/track-record/components/DrawRow.css';

// DrawRow — "This week's draw": the seed commitment published BEFORE the week, the seed revealed
// after it closed, and a "Verify this draw" control that recomputes the ranking in the browser.
// Everything comes from questions.weeks[]; with no commitment yet, the caller does not render it.
const short = (h) => (h ? `${String(h).slice(0, 8)}…${String(h).slice(-6)}` : '');

export default function DrawRow({ weeks = [], now = new Date() }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const today = new Date(now).toISOString().slice(0, 10);

  const view = useMemo(() => {
    const current = weeks.find((w) => w.weekStart <= today && today < new Date(Date.parse(`${w.weekStart}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10)) || null;
    const next = weeks.find((w) => w.weekStart > today) || null;
    const lastDrawn = [...weeks].reverse().find((w) => w.drawn && w.reveal && w.draw) || null;
    return { current, next, lastDrawn };
  }, [weeks, today]);

  if (!weeks.length) return null;
  const { current, next, lastDrawn } = view;

  async function onVerify() {
    setBusy(true);
    try { setResult(await verifyDraw(lastDrawn)); } catch { setResult({ ok: false, problems: ['this browser could not compute the hash'] }); } finally { setBusy(false); }
  }

  return (
    <div className="tr-draw">
      {current?.commit && (
        <p className="tr-draw-line">
          <b>This week ({fmtDay(current.weekStart)}):</b> commitment <code>{short(current.commit.hash)}</code> published {fmtDay(current.commit.committedAt)}
          {current.drawn ? '; drawn.' : '; the seed is revealed and the draw published after the week closes.'}
        </p>
      )}
      {next?.commit && (
        <p className="tr-draw-line">
          <b>Next week ({fmtDay(next.weekStart)}):</b> commitment <code>{short(next.commit.hash)}</code> published {fmtDay(next.commit.committedAt)}.
        </p>
      )}
      {lastDrawn ? (
        <p className="tr-draw-line">
          <b>Last draw ({fmtDay(lastDrawn.weekStart)}):</b> {lastDrawn.picked} of {lastDrawn.eligible} eligible questions from {lastDrawn.clusters} stories.{' '}
          <button type="button" className="tr-draw-verify" onClick={onVerify} disabled={busy}>
            {busy ? 'Verifying…' : 'Verify this draw'}
          </button>
        </p>
      ) : (
        <p className="tr-draw-line">No week has been drawn yet, so there is nothing to verify. The first draw is published after the first sampled week closes.</p>
      )}
      {result && (
        <p className={`tr-draw-result ${result.ok ? 'ok' : 'bad'}`} role="status">
          {result.ok
            ? `Verified in your browser: the revealed seed hashes to the commitment published before the week started, and ranking the ${result.eligible} eligible questions (one per story, lowest hash first) gives exactly the ${result.picked} published picks.`
            : `Not verified: ${result.problems.join('; ')}.`}
        </p>
      )}
    </div>
  );
}
