import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/contexts/AuthContext';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import Button from '@/shared/ui/Button.jsx';
import Card from '@/shared/ui/Card.jsx';
import '@/features/account/SignIn.css';

export default function AuthCallback() {
  const { completeSignIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    async function finish() {
      try {
        await completeSignIn(window.location.href);
        sessionStorage.setItem('gp_just_signed_in', '1');
        // Honor a ?returnTo= captured at sign-in (e.g. the membership funnel),
        // surviving the magic-link round-trip via localStorage. Default /weekly.
        const rt = localStorage.getItem('gp_return_to');
        localStorage.removeItem('gp_return_to');
        navigate(rt || '/weekly', { replace: true });
      } catch (err) {
        setError(err?.message || 'Sign-in failed. The link may have expired.');
      }
    }
    finish();
  }, [completeSignIn, navigate]);

  if (error) {
    return (
      <div className="acct-signin-shell">
        <Card className="acct-signin-panel">
          <div className="acct-signin-icon" aria-hidden="true">⚠️</div>
          <h2 className="acct-signin-title">Sign-in failed</h2>
          <p className="acct-signin-body">{error}</p>
          <Button variant="primary" to="/signin" className="acct-signin-cta">Try again</Button>
        </Card>
      </div>
    );
  }

  return <BootLoader variant="inline" label="Signing you in" text="Signing you in" />;
}
