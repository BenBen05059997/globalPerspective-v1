// WeeklyMarketsPage — a permalink, not a page. N1 (REDESIGN_MASTER_PLAN.md §3.1/§3.6, S3):
// /weekly-markets retires to /briefings with a paused note — economy is parked (project_economy.md),
// so briefings never carries a markets line. This thin wrapper keeps the old URL working (it's
// still linked from Home, Map, country + thread pages, and shared/SEO'd externally).
import { Navigate } from 'react-router-dom';

export default function WeeklyMarketsPage() {
  return <Navigate replace to="/briefings?from=markets" />;
}
