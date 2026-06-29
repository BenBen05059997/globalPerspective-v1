import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchMembership, billingConfigured } from '../services/restProxy';

// Current user's membership state from newsPolarBilling. Returns { tier:'member'|'free', ... }.
// `available` is false until window.POLAR_BILLING_ENDPOINT is configured — the UI uses it to
// show an honest "not available yet" state rather than a broken Subscribe button.
export function useMembership() {
  const { user } = useAuth();
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const available = billingConfigured();

  const refresh = useCallback(async () => {
    if (!available || !user || user.isAnonymous) { setMembership(null); return; }
    setLoading(true);
    setError(null);
    try {
      setMembership(await fetchMembership());
    } catch (err) {
      setError(err?.message || 'Failed to load membership');
    } finally {
      setLoading(false);
    }
  }, [available, user]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    membership,
    isMember: membership?.tier === 'member',
    creditBalance: Number(membership?.creditBalance) || 0,
    available,
    loading,
    error,
    refresh,
  };
}
