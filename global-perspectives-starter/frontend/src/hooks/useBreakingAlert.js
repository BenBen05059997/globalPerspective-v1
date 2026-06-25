import { useState, useEffect } from 'react';
import { fetchAlert } from '../services/restProxy';

// Single breaking alert for the /breaking/:id detail page. Honest by construction:
// `alert` stays null (→ a not-found state) when the id isn't a confirmed alert or
// the endpoint is unconfigured — never a fabricated placeholder story.
export function useBreakingAlert(id) {
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);

  const endpointMissing = typeof window !== 'undefined' && !window.USER_PREFS_ENDPOINT;

  useEffect(() => {
    let live = true;
    if (!id || endpointMissing) { setLoading(false); return; }
    setLoading(true);
    fetchAlert(id)
      .then((res) => { if (live) setAlert(res?.alert || null); })
      .catch(() => { if (live) setAlert(null); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id, endpointMissing]);

  return { alert, loading, endpointMissing };
}
