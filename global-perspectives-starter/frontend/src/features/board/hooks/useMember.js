import { useAuth } from '@/shared/contexts/AuthContext';
import { devMember } from '@/features/board/lib/boardApi.js';

// The board is a member tool: a signed-in, non-guest account. In a dev build opened with ?devBoard=1 the page
// acts as a signed-in member so it can be tried without Firebase (the dev fake takes no token).
export function useMember() {
  const { user, loading } = useAuth();
  if (devMember()) return { signedIn: true, loading: false, uid: 'dev-member' };
  return { signedIn: !!user && !user.isAnonymous, loading, uid: user?.uid || null };
}
