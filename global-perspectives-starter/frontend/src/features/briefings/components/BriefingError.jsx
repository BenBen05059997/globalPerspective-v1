import { useEffect } from 'react';
import Button from '@/shared/ui/Button.jsx';
import { reportFetchError } from '@/shared/api/errorSink';

// BriefingError — the request for a brief failed (network or server), which is not the same as
// "no brief was published". Says so plainly, reports the failure once to the error sink, and
// offers a retry. Shared by the three /briefings modes.
export default function BriefingError({ what, error, onRetry }) {
  useEffect(() => {
    if (error) reportFetchError(`briefings-${what}`, error instanceof Error ? error : new Error(String(error)));
  }, [what, error]);
  return (
    <div className="bm-error" role="alert">
      <p>The {what} brief could not be loaded: the request to the server failed.</p>
      {onRetry && <Button compact onClick={onRetry}>Try again</Button>}
    </div>
  );
}
