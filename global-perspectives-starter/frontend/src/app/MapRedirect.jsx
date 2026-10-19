// /map is retired as a URL (S6 home swap, 2026-10-01): the console lives at `/`. A client redirect
// that keeps ?layer= / ?country= / ?story= / ?focus= (and any hash), so old shared /map links land
// on the same view. The Worker sends a 301 for /map; this client redirect is the fallback.
import { Navigate, useLocation } from 'react-router';

export default function MapRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: '/', search, hash }} replace />;
}
