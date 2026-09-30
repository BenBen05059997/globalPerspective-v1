import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SharedAnalysisView from '@/features/analysis-studio/components/SharedAnalysisView.jsx';
import { EXAMPLE_SHARE_ID } from '@/features/analysis-studio/lib/sharedExample.js';
import { shareConfigured, fetchShare } from '@/features/analysis-studio/lib/shareApi.js';
import { reportFetchError } from '@/shared/api/errorSink';

// SignedOutExample — what a signed-out visitor sees instead of a locked mock-up: ONE real, complete, cited run
// (a real share the operator made; read-only, dated) — or, until that exists, an honest "not ready yet".
export default function SignedOutExample({ exampleId = EXAMPLE_SHARE_ID }) {
  const [share, setShare] = useState(null);
  const [failed, setFailed] = useState(false);
  const on = Boolean(exampleId) && shareConfigured();

  useEffect(() => {
    if (!on) return undefined;
    let live = true;
    fetchShare(exampleId)
      .then((r) => { if (live) { if (r.notFound) setFailed(true); else setShare(r.share); } })
      .catch((err) => { reportFetchError('studio-example', err); if (live) setFailed(true); });
    return () => { live = false; };
  }, [on, exampleId]);

  if (on && share) {
    return (
      <div className="as-example" data-testid="studio-example">
        <div className="label">Example: a real, cited analysis</div>
        <div className="as-example-scroll"><SharedAnalysisView share={share} compact /></div>
        <p className="as-example-cta">Sign in to run your own with your own key.{' '}
          <Link to={`/analyze/s/${exampleId}`} target="_blank" rel="noopener noreferrer">Open the example on its own page →</Link>
        </p>
      </div>
    );
  }
  return (
    <div className="as-example as-example-off" data-testid="studio-example-off">
      <strong>Example analysis: not ready yet.</strong>{' '}
      {on && !failed
        ? 'Loading the example…'
        : 'The first shared analysis will appear here as a read-only example of a full, cited run. Until then you can sign in and run your own.'}
    </div>
  );
}
