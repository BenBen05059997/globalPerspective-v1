import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useDailyBrief } from '@/shared/hooks/useDailyBrief';
import { useWeeklyBrief } from '@/features/briefings/hooks/useWeeklyBrief.js';
import { useDailyEditionsIndex } from '@/features/briefings/hooks/useDailyEditionsIndex.js';
import { useIsPhone } from '@/shared/hooks/useIsPhone.js';
import { briefingHref } from '@/shared/lib/links.js';
import { dateKeyOrNull } from '@/features/briefings/lib/dateKey.js';
import BriefingMode from '@/features/briefings/components/BriefingMode.jsx';
import PhoneBriefingMode from '@/features/briefings/components/PhoneBriefingMode.jsx';
import ReadMode from '@/features/briefings/components/ReadMode.jsx';
import WeeklyMode from '@/features/briefings/components/WeeklyMode.jsx';
import BriefingError from '@/features/briefings/components/BriefingError.jsx';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import Tabs from '@/shared/ui/Tabs.jsx';
import '@/features/briefings/BriefingsPage.css';

const MODES = [
  { key: 'read', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'present', label: 'Present' },
];
const MODE_KEYS = new Set(MODES.map((m) => m.key));

// PresentMode — /briefings?mode=present: the slide deck (map + slides + editions), daily by
// default, `deck=weekly` for the weekly deck. `date=` / `week=` pick the edition.
function PresentMode({ deck, dateParam, weekParam }) {
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const daily = useDailyBrief(dateParam || undefined);
  const weekly = useWeeklyBrief(weekParam);
  const { index: dailyEditionsIndex } = useDailyEditionsIndex(daily.servedDateKey);
  const current = deck === 'weekly' ? weekly : daily;

  useEffect(() => {
    document.title = `${deck === 'weekly' ? 'Weekly' : 'Daily'} briefing slides | Global Perspectives`;
  }, [deck]);

  const go = useCallback((to) => navigate(to, { replace: true }), [navigate]);
  const setDeck = useCallback((d) => go(briefingHref({ mode: 'present', deck: d })), [go]);
  const selectDailyDate = useCallback((dateKey) => {
    go(briefingHref({ mode: 'present', date: dateKey && dateKey !== daily.servedDateKey ? dateKey : null }));
  }, [go, daily.servedDateKey]);
  const weekHref = useCallback((week) => briefingHref({ mode: 'present', deck: 'weekly', week }), []);

  if (current.loading && !current.brief) {
    return <BootLoader variant="inline" label="Loading briefing" text="Loading briefing" />;
  }
  if (current.error && !current.brief) {
    return <BriefingError what={deck === 'weekly' ? 'weekly' : 'daily'} error={current.error} onRetry={current.refetch} />;
  }

  const Mode = isPhone ? PhoneBriefingMode : BriefingMode;
  return (
    <Mode
      mode={deck === 'weekly' ? 'weekly' : 'daily'}
      onModeChange={setDeck}
      dailyBrief={daily.brief}
      weeklyBrief={weekly.brief}
      dailyEditionsIndex={dailyEditionsIndex}
      dailyAnchorDateKey={daily.servedDateKey}
      requestedDateKey={dateParam}
      onSelectDailyDate={selectDailyDate}
      requestedWeek={weekParam}
      hrefForWeek={weekHref}
    />
  );
}

// BriefingsPage — /briefings, the one briefings page. Three modes, picked by `?mode=`:
//   read (default)  the daily brief as a long-form read          ?date=YYYY-MM-DD
//   weekly          the weekly signals brief as a long-form read  ?week=YYYY-MM-DD
//   present         the slide deck (map + slides + editions)      ?deck=weekly, ?date=, ?week=
// Old addresses (/daily, /daily/:date, /weekly-brief) redirect here (app/LegacyRedirects.jsx).
export default function BriefingsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const modeParam = searchParams.get('mode');
  const mode = MODE_KEYS.has(modeParam) ? modeParam : 'read';
  const dateParam = dateKeyOrNull(searchParams.get('date'));
  const weekParam = dateKeyOrNull(searchParams.get('week'));
  const deck = searchParams.get('deck') === 'weekly' ? 'weekly' : 'daily';

  // Switching mode keeps the edition that applies to the new mode (date for read, week for weekly).
  const setMode = useCallback((next) => {
    navigate(briefingHref({
      mode: next,
      date: next === 'read' ? dateParam : null,
      week: next === 'weekly' ? weekParam : null,
    }));
  }, [navigate, dateParam, weekParam]);

  return (
    <div className="bm-page">
      <div className="bm-page-head">
        <Tabs variant="segmented" idBase="brf-mode" label="Briefing mode" tabs={MODES} active={mode} onChange={setMode} />
      </div>
      {mode === 'read' && <ReadMode dateParam={dateParam} />}
      {mode === 'weekly' && <WeeklyMode weekParam={weekParam} />}
      {mode === 'present' && <PresentMode deck={deck} dateParam={dateParam} weekParam={weekParam} />}
    </div>
  );
}
