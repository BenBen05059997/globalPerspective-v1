import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useNoIndex } from '@/shared/hooks/useNoIndex.js';
import { reportFetchError } from '@/shared/api/errorSink';
import { devOps, loadOps, loadHealth } from '@/features/ops/lib/opsApi.js';
import { rememberOps } from '@/features/ops/hooks/useOpsAccess.js';
import MoneyPanel from '@/features/ops/components/MoneyPanel.jsx';
import PipelinePanel from '@/features/ops/components/PipelinePanel.jsx';
import ReadersPanel from '@/features/ops/components/ReadersPanel.jsx';
import QualityPanel from '@/features/ops/components/QualityPanel.jsx';
import '@/features/ops/ops.css';

// /ops: the operator's page. Signed out: one sign-in line. Signed in but not the operator: one line, no data (the server decides
// with a 403). The pipeline panel is public data (record/views/health.json) but is shown only here, to the operator.
export default function OpsPage() {
  useNoIndex();
  const { user, loading } = useAuth();
  const signedIn = devOps() ? true : !!user && !user.isAnonymous;
  const uid = devOps() ? 'dev-operator' : user?.uid || null;
  const [ops, setOps] = useState({ state: 'loading', data: null });
  const [health, setHealth] = useState({ state: 'loading', data: null });

  useEffect(() => {
    if (loading || !signedIn) return undefined;
    let live = true;
    loadOps().then(({ status, data }) => {
      rememberOps(uid, status === 200);
      if (live) setOps(status === 200 ? { state: 'ok', data } : { state: 'forbidden', data: null });
    }, (e) => {
      reportFetchError('ops-money', e);
      if (live) setOps({ state: 'error', data: null });
    });
    return () => { live = false; };
  }, [loading, signedIn, uid]);

  const operator = ops.state === 'ok';
  useEffect(() => {
    if (!operator) return undefined;
    let live = true;
    loadHealth().then((data) => { if (live) setHealth({ state: 'ok', data }); }, (e) => {
      reportFetchError('ops-health', e);
      if (live) setHealth({ state: 'error', data: null });
    });
    return () => { live = false; };
  }, [operator]);

  if (loading) return <div className="ops-page" aria-busy="true" />;
  if (!signedIn) {
    return (
      <div className="ops-page">
        <p className="ops-line">The ops page is for the signed-in operator. <Link className="ops-link" to={`/signin?returnTo=${encodeURIComponent('/ops')}`}>Sign in</Link></p>
      </div>
    );
  }
  if (ops.state === 'loading') return <div className="ops-page" aria-busy="true"><p className="ops-line">Loading.</p></div>;
  if (ops.state === 'forbidden') return <div className="ops-page"><p className="ops-line">The ops page is not available for this account.</p></div>;
  if (ops.state === 'error') return <div className="ops-page"><p className="ops-line">The ops page could not be loaded. Try again in a moment.</p></div>;

  return (
    <div className="ops-page">
      <h1 className="ops-title">Ops</h1>
      <MoneyPanel ops={ops.data} />
      {health.state === 'loading' ? <p className="ops-line" aria-busy="true">Loading the pipeline view.</p>
        : health.state === 'error' ? <p className="ops-line">The pipeline view could not be loaded.</p>
          : <PipelinePanel health={health.data} />}
      <ReadersPanel readers={ops.data?.readers} />
      <QualityPanel quality={ops.data?.quality} />
    </div>
  );
}
