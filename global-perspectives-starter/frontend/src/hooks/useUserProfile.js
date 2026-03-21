import { useState, useEffect } from 'react';
import { fetchUserProfile } from '../services/restProxy';
import { useAuth } from '../contexts/AuthContext';

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    setLoading(true);
    fetchUserProfile()
      .then(res => setProfile(res?.data || { tier: 'free', trialDaysLeft: 0 }))
      .catch(() => setProfile({ tier: 'free', trialDaysLeft: 0 }))
      .finally(() => setLoading(false));
  }, [user]);

  return { profile, loading };
}
