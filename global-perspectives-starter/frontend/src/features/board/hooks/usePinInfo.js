import { useEffect, useMemo, useState } from 'react';
import { fetchThreadAnalyses } from '@/shared/api/restProxy';
import { reportFetchError } from '@/shared/api/errorSink';
import { pinLabel } from '@/features/board/lib/boardOps.js';

// Titles and risk numbers for thread pins (a board stores only the thread id). Sources, in order: today's
// topics (title), a preset's pins (title, risk; remembered below), the thread analysis (title, risk).
// A pin with no known title shows its id in words; one with no risk shows no number. Nothing is invented.
const remembered = { titles: {}, risks: {} };

export function rememberPinInfo(pins) {
  for (const p of pins || []) {
    if (p.kind !== 'thread') continue;
    if (p.title) remembered.titles[p.refId] = p.title;
    if (Number.isFinite(Number(p.riskScore)) && p.riskScore != null) remembered.risks[p.refId] = Number(p.riskScore);
  }
}

export function usePinInfo(pins, topics) {
  const [analyses, setAnalyses] = useState({});
  const ids = useMemo(() => pins.filter((p) => p.kind === 'thread').map((p) => p.refId).sort(), [pins]);
  const idsKey = ids.join(',');

  useEffect(() => {
    if (!ids.length) return undefined;
    let live = true;
    fetchThreadAnalyses(ids)
      .then((res) => { if (live && res?.data) setAnalyses((prev) => ({ ...prev, ...res.data })); })
      .catch((err) => reportFetchError('board-pin-info', err));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return useMemo(() => {
    const titles = { ...remembered.titles };
    const risks = { ...remembered.risks };
    for (const [id, a] of Object.entries(analyses)) {
      if (a?.threadTitle) titles[id] = a.threadTitle;
      if (a?.riskScore != null && Number.isFinite(Number(a.riskScore))) risks[id] = Number(a.riskScore);
    }
    for (const t of topics || []) if (t.threadId && t.title) titles[t.threadId] = t.title;
    const out = {};
    for (const p of pins) out[p.pinId] = pinLabel(p, titles, risks);
    return out;
  }, [pins, analyses, topics]);
}
