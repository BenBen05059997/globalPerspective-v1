import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchPrefs, savePrefs } from '../services/restProxy';

// Per-user email-notification preferences (newsRecommend get_prefs/set_prefs).
// Defaults are OFF (opt-in). Optimistic save with revert-on-error — never shows a
// success state that didn't actually persist.
const DEFAULTS = { breakingOptIn: false, digestOptIn: false, digestCadence: 'weekly' };

export function usePreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const endpointMissing = typeof window !== 'undefined' && !window.USER_PREFS_ENDPOINT;
  const signedIn = !!user && !user.isAnonymous;

  useEffect(() => {
    let alive = true;
    if (!signedIn || endpointMissing) { setLoading(false); return; }
    setLoading(true);
    fetchPrefs()
      .then((res) => { if (alive && res?.prefs) setPrefs(res.prefs); })
      .catch((e) => { if (alive) setError(e.message || 'Could not load preferences'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [signedIn, endpointMissing]);

  const save = useCallback(async (patch) => {
    setError(null);
    setSaving(true);
    let prev;
    setPrefs((p) => { prev = p; return { ...p, ...patch }; }); // optimistic
    try {
      const res = await savePrefs(patch);
      if (res?.prefs) setPrefs(res.prefs);
    } catch (e) {
      setPrefs(prev); // revert — no fake success
      setError(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }, []);

  return { prefs, loading, saving, error, save, endpointMissing, signedIn };
}
