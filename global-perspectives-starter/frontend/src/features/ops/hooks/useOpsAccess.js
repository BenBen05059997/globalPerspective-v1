import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/contexts/AuthContext';
import { fetchOps } from '@/shared/api/restProxy';
import { devOps } from '@/features/ops/lib/opsApi.js';

// Whether this account is the operator, for the account-area "Ops" link. Learned only from the server: the `ops` action
// answering 200 once. Kept in memory for the session (never in storage), per uid; a 403 or a failed call shows no link.
const answered = new Map(); // uid -> true (200) | false (403); a failed call is not remembered, the next mount asks again

/** Remember that the `ops` action answered for this uid (the page calls it with its own answer, so the shell does not probe again). */
export function rememberOps(uid, ok) { if (uid) answered.set(uid, ok); }

export function useOpsAccess() {
  const { user, loading } = useAuth();
  const uid = !loading && user && !user.isAnonymous ? user.uid : null;
  const [, bump] = useState(0);

  useEffect(() => {
    if (!uid || answered.has(uid)) return undefined;
    let live = true;
    fetchOps().then(({ status }) => { answered.set(uid, status === 200); }, () => {}).finally(() => { if (live) bump((n) => n + 1); });
    return () => { live = false; };
  }, [uid]);

  if (devOps()) return devOps() === 'operator'; // dev fixtures (?devOps=1): no sign-in needed
  return Boolean(uid && answered.get(uid));
}

/** Test helper: forget what the session knows. */
export function resetOpsAccess() { answered.clear(); }
