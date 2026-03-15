import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchUserProfile } from '../services/restProxy';
import './WeeklyPage.css';

export default function UpgradeSuccess() {
  const { user } = useAuth();
  const [tier, setTier] = useState(null);
  const [attempts, setAttempts] = useState(0);

  // Poll for tier confirmation — webhook may arrive a second or two after redirect
  useEffect(() => {
    if (!user || attempts >= 5) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetchUserProfile();
        const t = res?.data?.tier;
        if (t && t !== 'free') {
          setTier(t);
        } else {
          setAttempts(a => a + 1);
        }
      } catch {
        setAttempts(a => a + 1);
      }
    }, attempts === 0 ? 1000 : 2000);
    return () => clearTimeout(timer);
  }, [user, attempts]);

  return (
    <div className="weekly-gate" style={{ maxWidth: 480, margin: '4rem auto' }}>
      <div className="weekly-gate-icon">🎉</div>
      <h2>You're in!</h2>
      {tier ? (
        <>
          <p>Your <strong>{tier}</strong> access is active. You can now use the Weekly narrative view.</p>
          <Link to="/weekly" className="weekly-gate-submit" style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none' }}>
            Go to Weekly →
          </Link>
        </>
      ) : (
        <>
          <p>Your payment was received. Access is activating — this usually takes a few seconds.</p>
          {attempts >= 5 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Taking longer than expected? Try <Link to="/weekly">opening Weekly</Link> or check your <Link to="/account">account</Link>. Contact us if the issue persists.
            </p>
          )}
          {attempts < 5 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Confirming access…</p>
          )}
        </>
      )}
    </div>
  );
}
