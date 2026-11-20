import { useEffect, useState } from 'react';
import { reportFetchError } from '@/shared/api/errorSink';
import { fetchThemesIndex } from '@/features/board/lib/recordViews.js';

// The theme boards: index/themes.json, a public read (never gated on sign-in). A missing file (404) is no themes; any
// other failure is reported to the error sink and marks `failed`, so the page leaves the section out.
export function useThemes() {
  const [state, setState] = useState({ themes: [], loading: true, failed: false });
  useEffect(() => {
    let live = true;
    fetchThemesIndex()
      .then((index) => { if (live) setState({ themes: Array.isArray(index?.themes) ? index.themes : [], loading: false, failed: false }); })
      .catch((err) => { reportFetchError('board-themes', err); if (live) setState({ themes: [], loading: false, failed: true }); });
    return () => { live = false; };
  }, []);
  return state;
}
