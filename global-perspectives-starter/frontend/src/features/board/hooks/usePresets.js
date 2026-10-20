import { useEffect, useState } from 'react';
import { reportFetchError } from '@/shared/api/errorSink';
import { callBoard } from '@/features/board/lib/boardApi.js';
import { rememberPinInfo } from '@/features/board/hooks/usePinInfo.js';

// Region presets (list_presets is public, so this works signed out): [{presetId, name, region, pins, strings}].
// Their pins carry a title and risk, which are remembered so a forked board can show them.
export function usePresets(enabled = true) {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    setLoading(true);
    callBoard('list_presets', {}, { auth: false })
      .then((list) => {
        if (!live) return;
        const rows = Array.isArray(list) ? list : [];
        rows.forEach((p) => rememberPinInfo(p.pins));
        setPresets(rows);
      })
      .catch((err) => reportFetchError('board-presets', err))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [enabled]);

  return { presets, loading };
}
