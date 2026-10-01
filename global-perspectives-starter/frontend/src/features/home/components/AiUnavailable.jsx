import { useEffect } from 'react';
import { reportFetchError } from '@/shared/api/errorSink';

// The honest "this AI result is not available" state for a story's Summary / Prediction / Trace.
// It sits where the content would be, says plainly that nothing was generated, and offers Retry —
// no raw error text and no "something went wrong" card. The underlying failure goes to the passive
// client-error sink (reportFetchError), not to the reader.
export default function AiUnavailable({ containerRef, what, onRetry, onClear, error }) {
  const slug = String(what).toLowerCase().replace(/[^a-z]+/g, '-');
  useEffect(() => {
    if (error) reportFetchError(`today-${slug}`, error instanceof Error ? error : new Error(String(error)));
  }, [error, what, slug]);
  return (
    <div ref={containerRef} className="ai-result-card ai-unavailable" role="status" data-testid={`ai-unavailable-${slug}`}>
      <div className="ai-unavailable-row">
        <span className="ai-unavailable-text">{what} unavailable right now</span>
        <span className="ai-result-actions">
          <button type="button" className="ai-btn ai-unavailable-btn" onClick={onRetry}>Retry</button>
          <button type="button" className="ai-btn ai-unavailable-btn" onClick={onClear}>Close</button>
        </span>
      </div>
    </div>
  );
}
