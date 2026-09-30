// /map is retired as a URL (S6 home swap, 2026-10-01): the console lives at `/`. A client redirect
// that keeps ?layer= / ?country= / ?story= / ?focus= (and any hash), so old shared /map links land
// on the same view. GitHub Pages and the Worker send no real 301s, so this is client-side.
import { Navigate, useLocation } from 'react-router-dom';

export default function MapRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: '/', search, hash }} replace />;
}
