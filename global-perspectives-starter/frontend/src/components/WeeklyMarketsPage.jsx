// WeeklyMarketsPage — now a permalink, not a page. The weekly markets wrap was
// consolidated into /economy as its "This week" mode (see WeeklyMarketsView). This
// thin wrapper keeps the /weekly-markets URL working (it's still linked from Home,
// Map, country + thread pages, and shared/SEO'd externally) by redirecting into
// that mode. The original instrument anchor (#BRENT) is preserved on the hop so
// deep-links still land on the right mover row (WeeklyMarketsView re-scrolls once
// the async data renders).
import { Navigate, useLocation } from 'react-router-dom';

export default function WeeklyMarketsPage() {
  const location = useLocation();
  return <Navigate replace to={{ pathname: '/economy', search: '?view=week', hash: location.hash }} />;
}
