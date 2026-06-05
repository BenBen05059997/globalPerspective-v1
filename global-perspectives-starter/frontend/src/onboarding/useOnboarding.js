// Runs guided tours with driver.js and decides what to auto-show.
//
// Persistence: a tour is shown automatically at most once (per visitor, per browser),
// tracked by a versioned localStorage flag. The "?" button replays on demand and ignores
// the flag. Steps whose anchor element is absent at drive time are dropped, so a tour
// never points at nothing.

import { useEffect } from 'react';
import { SITE_WELCOME, SITE_INTRO, pageTourForPath } from './tours.js';

// Lazy-load driver.js + its styles on first tour run, so the ~25kb library stays out of
// the main bundle for the (majority) of page views that never trigger a tour. Cached after
// the first load. Our theme uses higher specificity than driver's defaults, so the order
// the two stylesheets inject in doesn't matter.
let driverPromise;
function loadDriver() {
  if (!driverPromise) {
    driverPromise = Promise.all([
      import('driver.js'),
      import('driver.js/dist/driver.css'),
      import('./tour-theme.css'),
    ]).then(([mod]) => mod.driver);
  }
  return driverPromise;
}

const SEEN_PREFIX = 'gp_tour_v1_';

function hasSeen(id) {
  try { return localStorage.getItem(SEEN_PREFIX + id) === '1'; } catch { return false; }
}
function markSeen(id) {
  try { localStorage.setItem(SEEN_PREFIX + id, '1'); } catch { /* storage full / blocked */ }
}

// Poll for a selector to appear (data loads async). Resolves true once present, false on timeout.
function waitFor(selector, timeoutMs = 4000) {
  if (!selector) return Promise.resolve(true);
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      if (document.querySelector(selector)) return resolve(true);
      if (performance.now() - start > timeoutMs) return resolve(false);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

// Drive a tour, keeping only steps with an existing (or no) anchor element.
export async function runTour(tour) {
  if (!tour?.steps?.length) return;
  const steps = tour.steps.filter((s) => !s.element || document.querySelector(s.element));
  if (steps.length === 0) return;
  const driver = await loadDriver();
  const d = driver({
    showProgress: steps.length > 1,
    allowClose: true,
    overlayOpacity: 0.6,
    stagePadding: 6,
    stageRadius: 8,
    popoverClass: 'gp-tour',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    steps,
  });
  d.drive();
}

// Imperatively start the right tour for a path (used by the "?" button — always plays).
export function startTourForPath(pathname) {
  const tour = pageTourForPath(pathname);
  runTour(tour || SITE_INTRO);
}

// Auto-show on first visit: a single welcome popover once ever, then each page tour once
// per page. The fuller SITE_INTRO walk is on-demand only (the "?" button), never auto-shown.
// Never chains two tours in one navigation.
export function useAutoTour(pathname) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasSeen(SITE_WELCOME.id)) {
        const ok = await waitFor('[data-tour="nav-brand"]', 1500);
        if (cancelled || !ok) return;
        markSeen(SITE_WELCOME.id);
        runTour(SITE_WELCOME);
        return;
      }
      const tour = pageTourForPath(pathname);
      if (!tour || hasSeen(tour.id)) return;
      const anchor = tour.readyAnchor || tour.steps?.[0]?.element;
      const ok = await waitFor(anchor, 4000);
      if (cancelled || !ok) return;
      markSeen(tour.id);
      runTour(tour);
    })();
    return () => { cancelled = true; };
  }, [pathname]);
}
