import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router';

// Google Analytics page views. index.html configures gtag with send_page_view:false, so the first view is not sent with the
// shell's static <title>: each route sends one page_view here, once the page has set document.title (or after TITLE_WAIT_MS
// when it keeps the title it has). The first load goes through the same path, so it is counted once.
const TITLE_WAIT_MS = 1500;

let pending = null; // { href, stop }: the route whose page_view is waiting for its title

function send() {
  if (!pending) return;
  const { href, stop } = pending;
  pending = null;
  stop();
  window.gtag?.('event', 'page_view', { page_title: document.title, page_location: href });
}

export function trackPageView(href) {
  if (pending?.href === href) return; // StrictMode runs a layout effect twice in dev
  send(); // a route left before its title arrived still counts, with the title it had
  const watcher = new MutationObserver(send); // any write to <title> (document.title = ...) is the page naming itself
  watcher.observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true });
  const timer = setTimeout(send, TITLE_WAIT_MS);
  pending = { href, stop: () => { watcher.disconnect(); clearTimeout(timer); } };
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', send);

// Mounted once inside the router. A layout effect, so the watcher is set before the page's own (passive) effect sets the title,
// and a pending view is flushed before the new page's title replaces the old one.
export function PageViewBridge() {
  const { pathname } = useLocation();
  useLayoutEffect(() => { trackPageView(window.location.href); }, [pathname]);
  return null;
}
