// Public API of the ops feature. The page itself is lazy-loaded by path in app/App.jsx (its own chunk), so nothing here may
// import it. The shell uses `useOpsAccess` to show the account-area "Ops" link only after the server has said yes once.
export { useOpsAccess } from '@/features/ops/hooks/useOpsAccess.js';
/** The page address. Kept here, not in shared/lib/links.js: that file's core is mirrored into the Lambdas' link code and /ops is never emailed. */
export const OPS_ROUTE = '/ops';
