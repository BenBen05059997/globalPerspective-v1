import { useMemo, useState } from 'react';
import { buildSharePayload, shareableSections, sameCitations } from '@/features/analysis-studio/lib/sharePayload.js';
import { shareConfigured, createShare, rememberShare, loadMyShares, forgetShare, deleteShare } from '@/features/analysis-studio/lib/shareApi.js';

// ShareControl — "Share this analysis". Rendered ONLY when the share endpoint is configured AND at least one section
// passed its checks (a failed run has no button at all; it already says "not shareable"). Sharing sends the run's
// prose + numbering; the server re-fetches and freezes the sources itself and re-runs the checks.
function shareUrl(id) {
  return `${window.location.origin}/analyze/s/${id}`;
}

export default function ShareControl({ sections, selectedTopics, byok }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [made, setMade] = useState(null);       // { id, url }
  const [copied, setCopied] = useState(false);
  const [mine, setMine] = useState(() => loadMyShares());

  const ok = useMemo(() => shareableSections(sections), [sections]);
  if (!shareConfigured() || ok.length === 0) return null;
  const failedCount = sections.length - ok.length;
  const consistent = sameCitations(sections);

  async function onShare() {
    setBusy(true); setError(null); setCopied(false);
    try {
      const payload = buildSharePayload({ sections, selectedTopics, byok });
      const { id } = await createShare(payload);
      rememberShare(id, (selectedTopics[0] && selectedTopics[0].title) || 'Shared analysis');
      setMine(loadMyShares());
      setMade({ id, url: shareUrl(id) });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function onCopy() {
    try { await navigator.clipboard.writeText(made.url); setCopied(true); } catch { setCopied(false); setError('Your browser blocked copying; select the link and copy it.'); }
  }
  async function onDelete(id) {
    try { await deleteShare(id); forgetShare(id); setMine(loadMyShares()); if (made && made.id === id) setMade(null); } catch (e) { setError(e.message); }
  }

  return (
    <div className="as-share" data-testid="share-control">
      {!made ? (
        <>
          <button type="button" className="as-run as-share-btn" onClick={onShare} disabled={busy || !consistent}>
            {busy ? 'Sharing…' : `Share ${ok.length > 1 ? `these ${ok.length} analyses` : 'this analysis'}`}
          </button>
          <span className="as-share-note">
            Creates an unlisted, read-only page (not indexed by search engines). We freeze the sources from our data and re-run the checks;
            anyone with the link can read it. You can delete it any time.
            {failedCount > 0 ? ` ${failedCount} analys${failedCount === 1 ? 'is' : 'es'} that failed checks ${failedCount === 1 ? 'is' : 'are'} not included.` : ''}
            {!consistent ? ' These analyses cited different sources, so they cannot be shared together.' : ''}
          </span>
        </>
      ) : (
        <div className="as-share-made" role="status">
          <div>Shared. Anyone with this link can read it:</div>
          <input className="as-input as-share-url" readOnly value={made.url} onFocus={(e) => e.target.select()} aria-label="Share link" />
          <div className="as-share-actions">
            <button type="button" className="as-link-btn" onClick={onCopy}>{copied ? 'Copied ✓' : 'Copy link'}</button>
            <a className="as-link-btn" href={made.url} target="_blank" rel="noopener noreferrer">Open</a>
            <button type="button" className="as-link-btn as-share-delete" onClick={() => onDelete(made.id)}>Delete</button>
          </div>
        </div>
      )}
      {error && <div className="as-error as-share-error" role="alert"><div>{error}</div></div>}
      {mine.length > 0 && (
        <details className="as-share-mine">
          <summary>Your shared analyses on this browser ({mine.length})</summary>
          <ul>
            {mine.map((m) => (
              <li key={m.id}>
                <a href={`/analyze/s/${m.id}`} target="_blank" rel="noopener noreferrer">{m.title || m.id}</a>
                <button type="button" className="as-link-btn" onClick={() => onDelete(m.id)}>Delete</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
