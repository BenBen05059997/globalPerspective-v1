import { useEffect } from 'react';

// Tells search engines not to index the current page: <meta name="robots" content="noindex,nofollow">.
// Set on mount and removed on unmount (the SPA shell is shared, so a leftover tag would de-index other pages).
// The Worker never pre-renders these pages and the share API also sends X-Robots-Tag.
export function useNoIndex(active = true) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('content', 'noindex,nofollow');
    meta.setAttribute('data-gp-noindex', '1');
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, [active]);
}
