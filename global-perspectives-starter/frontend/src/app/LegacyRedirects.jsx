// Retired routes (REDESIGN_MASTER_PLAN.md §3.1 / §3.9, operator 2026-10-01). GitHub Pages and the
// Worker send no real 301s, so these are client redirects; old links and emailed URLs keep working.
//   /weekly-markets      -> /briefings?from=markets  (briefings shows the one-line "paused" note)
//   /spider-demo         -> /weekly?view=web          (the unlisted prototype retired into the Stories WEB view)
//   /breaking            -> /                         (the map's alert stack replaced the feed)
//   /breaking/:id        -> the alert's story /weekly/thread/:threadId when the alert resolves to
//                           one (the single-alert read says it has an arc), else /
// Briefings merge (2026-10-19): one /briefings page with read / weekly / present modes.
//   /daily               -> /briefings?mode=read
//   /daily/:dateKey      -> /briefings?mode=read&date=:dateKey  (a malformed date drops to latest)
//   /weekly-brief        -> /briefings?mode=weekly
// The countries list keeps one address (2026-10-19):
//   /weekly?section=countries -> /weekly/countries  (WeeklyRoute; every other /weekly renders the page)
// The Worker sends real 301s for these; the client redirects stay as the fallback.
import { Navigate, useParams, useSearchParams } from 'react-router';
import { useBreakingAlert } from '@/features/breaking';
import { briefingPath, dateKeyOrNull } from '@/features/briefings';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import { threadPath } from '@/shared/lib/threadPath';

export function DailyRedirect() {
  const { dateKey } = useParams();
  return <Navigate replace to={briefingPath({ date: dateKeyOrNull(dateKey) })} />;
}

export function WeeklyBriefRedirect() {
  return <Navigate replace to={briefingPath({ mode: 'weekly' })} />;
}

export function WeeklyRoute({ children }) {
  const [searchParams] = useSearchParams();
  if (searchParams.get('section') === 'countries') return <Navigate replace to="/weekly/countries" />;
  return children;
}

export function MarketsRedirect() {
  return <Navigate replace to="/briefings?from=markets" />;
}

export function SpiderDemoRedirect() {
  return <Navigate replace to="/weekly?view=web" />;
}

export function BreakingFeedRedirect() {
  return <Navigate replace to="/" />;
}

export function BreakingDetailRedirect() {
  const { id } = useParams();
  const { alert, loading } = useBreakingAlert(id);
  if (loading) return <BootLoader variant="inline" label="Opening the story" text="Opening the story" />;
  const to = alert && alert.hasArc && alert.threadId ? threadPath(alert.threadId) : '/';
  return <Navigate replace to={to} />;
}
