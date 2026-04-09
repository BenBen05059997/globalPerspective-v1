import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './WeeklyPage.css';
import IntelligenceLoader from './IntelligenceLoader';

export default function AuthCallback() {
  const { completeSignIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    async function finish() {
      try {
        await completeSignIn(window.location.href);
        sessionStorage.setItem('gp_just_signed_in', '1');
        navigate('/weekly', { replace: true });
      } catch (err) {
        setError(err?.message || 'Sign-in failed. The link may have expired.');
      }
    }
    finish();
  }, [completeSignIn, navigate]);

  if (error) {
    return (
      <div className="weekly-gate">
        <div className="weekly-gate-icon">⚠️</div>
        <h2>Sign-in failed</h2>
        <p>{error}</p>
        <Link to="/signin" className="weekly-gate-submit" style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none' }}>
          Try again
        </Link>
      </div>
    );
  }

  return <IntelligenceLoader type="typewriter" />;
}
