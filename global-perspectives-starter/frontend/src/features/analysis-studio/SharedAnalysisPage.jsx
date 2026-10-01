import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import SharedAnalysisView from '@/features/analysis-studio/components/SharedAnalysisView.jsx';
import { shareConfigured, fetchShare, deleteShare, forgetShare } from '@/features/analysis-studio/lib/shareApi.js';
import { useNoIndex } from '@/shared/hooks/useNoIndex.js';
import { reportFetchError } from '@/shared/api/errorSink';
import '@/features/analysis-studio/AnalysisStudio.css';

// /analyze/s/:id — a read-only, unlisted (noindex) debrief of one shared Studio run. States, all honest:
// loading, endpoint not configured, deleted / never existed, could not be loaded, ready.
export default function SharedAnalysisPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  useNoIndex(true);
  const [state, setState] = useState(() => (shareConfigured() ? { kind: 'loading' } : { kind: 'off' }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { document.title = 'Shared analysis | Global Perspectives'; }, []);
  useEffect(() => {
    if (!shareConfigured()) { setState({ kind: 'off' }); return undefined; }
    let live = true;
    setState({ kind: 'loading' });
    fetchShare(id)
      .then((r) => { if (live) setState(r.notFound ? { kind: 'gone' } : { kind: 'ready', share: r.share }); })
      .catch((err) => { reportFetchError('shared-analysis', err); if (live) setState({ kind: 'failed' }); });
    return () => { live = false; };
  }, [id]);

  async function onDelete() {
    if (!window.confirm('Delete this shared analysis? Its link stops working for everyone.')) return;
    setBusy(true); setError(null);
    try { await deleteShare(id); forgetShare(id); setState({ kind: 'gone' }); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="as-page as-shared-page">
      {state.kind === 'loading' && <BootLoader variant="inline" label="Loading the shared analysis" text="Loading the shared analysis" />}
      {state.kind === 'off' && (
        <div className="as-shared-state">
          <h1>Shared analyses are not available yet</h1>
          <p>Sharing has not been switched on for this site yet. Analysis Studio itself works as usual.</p>
          <Link to="/analyze">Open Analysis Studio →</Link>
        </div>
      )}
      {state.kind === 'gone' && (
        <div className="as-shared-state">
          <h1>This shared analysis was deleted or never existed</h1>
          <p>Its link does not point to anything we hold. The person who shared it may have removed it.</p>
          <Link to="/analyze">Run your own analysis →</Link>
        </div>
      )}
      {state.kind === 'failed' && (
        <div className="as-shared-state">
          <h1>This shared analysis could not be loaded right now</h1>
          <p>Our share service did not answer. Reload the page in a minute; if it keeps failing, the link may be broken.</p>
        </div>
      )}
      {state.kind === 'ready' && (
        <>
          <SharedAnalysisView share={state.share} />
          <div className="as-shared-actions">
            <Link className="as-run" to="/analyze">Run your own →</Link>
            {(state.share.stories || []).some((s) => s.threadId) && (
              <span>
                Open these stories live:{' '}
                {state.share.stories.filter((s) => s.threadId).map((s, i) => (
                  <span key={s.threadId}>{i > 0 ? ' · ' : ''}<Link to={`/weekly/thread/${encodeURIComponent(s.threadId)}`}>{s.title}</Link></span>
                ))}
              </span>
            )}
            {state.share.owner && (
              <button type="button" className="as-link-btn as-shared-delete" onClick={onDelete} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete this share'}
              </button>
            )}
          </div>
          {error && <div className="as-error"><div>{error}</div></div>}
        </>
      )}
      <button type="button" className="as-gate-back as-shared-back" onClick={() => navigate(-1)}>← Back</button>
    </div>
  );
}
