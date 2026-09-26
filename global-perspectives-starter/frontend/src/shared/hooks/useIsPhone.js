import { useEffect, useState } from 'react';

// Shared 900px phone breakpoint (moved from features/map/hooks in A2 so the app-level Layout
// can use it too, e.g. the phone tab bar). M7's phone layout (MAP · LIST · ALERTS tabs + bottom
// sheet) and SituationHome.css's `.sh-stage` column collapse both switch at this same width — a
// single hook keeps every consumer and their tests aligned on one definition. Tests mock this
// module rather than trying to shrink jsdom's window.
export const PHONE_BREAKPOINT = 900;

export function useIsPhone(breakpoint = PHONE_BREAKPOINT) {
  const [isPhone, setIsPhone] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  ));
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setIsPhone(window.innerWidth < breakpoint);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isPhone;
}

export default useIsPhone;
