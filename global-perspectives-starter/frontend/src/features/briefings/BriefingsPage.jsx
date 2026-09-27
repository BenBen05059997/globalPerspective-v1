import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDailyBrief } from '@/features/daily/hooks/useDailyBrief';
import { useWeeklyBrief } from '@/features/weekly-brief/hooks/useWeeklyBrief';
import { useDailyEditionsIndex } from '@/features/briefings/hooks/useDailyEditionsIndex.js';
import { useIsPhone } from '@/shared/hooks/useIsPhone.js';
import BriefingMode from '@/features/briefings/components/BriefingMode.jsx';
import PhoneBriefingMode from '@/features/briefings/components/PhoneBriefingMode.jsx';
import '@/features/briefings/BriefingsPage.css';

// BriefingsPage — S3: /briefings, briefing mode (map + horizontal slides + editions strip), the
// same pattern as story mode. DAILY/WEEKLY chosen by ?mode=, a specific daily edition by ?date=
// (both optional — default is the latest of whichever mode). `?from=markets` (the retired
// /weekly-markets redirect) shows a one-line paused note; briefings never carries a markets line
// while economy stays parked (REDESIGN_MASTER_PLAN.md §3.6).
export default function BriefingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isPhone = useIsPhone();

  const modeParam = searchParams.get('mode') === 'weekly' ? 'weekly' : 'daily';
  const dateParam = searchParams.get('date') || null;
  const fromMarkets = searchParams.get('from') === 'markets';

  useEffect(() => { document.title = 'Briefings | Global Perspectives'; }, []);

  const { brief: dailyBrief, servedDateKey, loading: dailyLoading } = useDailyBrief(dateParam || undefined);
  const { brief: weeklyBrief, loading: weeklyLoading } = useWeeklyBrief();

  const { index: dailyEditionsIndex } = useDailyEditionsIndex(servedDateKey);

  const setMode = useCallback((mode) => {
    const next = new URLSearchParams(searchParams);
    if (mode === 'weekly') next.set('mode', 'weekly'); else next.delete('mode');
    next.delete('date'); // a date param only ever applies to the daily edition
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const selectDailyDate = useCallback((dateKey) => {
    const next = new URLSearchParams(searchParams);
    next.delete('mode');
    if (dateKey && dateKey !== servedDateKey) next.set('date', dateKey); else next.delete('date');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, servedDateKey]);

  const loading = modeParam === 'weekly' ? weeklyLoading : dailyLoading;

  if (loading && !dailyBrief && !weeklyBrief) {
    return (
      <div className="bm-page">
        <div className="gp-console bm-root bm-loading">Loading briefing…</div>
      </div>
    );
  }

  const Mode = isPhone ? PhoneBriefingMode : BriefingMode;

  return (
    <div className="bm-page">
      {fromMarkets && (
        <div className="bm-markets-note">
          Weekly markets briefings are paused while the economy section is parked — no markets line here.
        </div>
      )}
      <Mode
        mode={modeParam}
        onModeChange={setMode}
        dailyBrief={dailyBrief}
        weeklyBrief={weeklyBrief}
        dailyEditionsIndex={dailyEditionsIndex}
        dailyAnchorDateKey={servedDateKey}
        requestedDateKey={dateParam}
        onSelectDailyDate={selectDailyDate}
      />
    </div>
  );
}
