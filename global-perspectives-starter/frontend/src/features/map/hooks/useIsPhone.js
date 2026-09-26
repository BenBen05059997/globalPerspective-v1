import { useEffect, useState } from 'react';

// M7: the phone layout (MAP · LIST · ALERTS tabs + bottom sheet) switches at the same 900px
// breakpoint the rest of the console already uses (SituationHome.css `.sh-stage` collapses to
// one column at 900px too). A single hook so SituationHome and its tests share one definition —
// tests mock this module rather than trying to shrink jsdom's window.
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
