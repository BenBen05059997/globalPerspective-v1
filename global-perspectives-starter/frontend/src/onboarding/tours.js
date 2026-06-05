// Guided-tour definitions. Each tour is { id, steps[] } where a step is
// { element?, popover:{ title, description, side?, align? } }. `element` is a CSS
// selector resolved at drive time; steps whose element is missing are dropped by the
// runner (useOnboarding), so a tour degrades gracefully on empty/loading pages.
//
// Three kinds of tour:
//   • SITE_WELCOME — a single centered popover (no anchor), shown once on a visitor's
//     first ever load. One glance, no step-by-step procedure.
//   • SITE_INTRO — the fuller "what is this product" walk, anchored to the persistent
//     nav. NOT auto-shown; replayed on demand from the "?" button on pages without a
//     page tour.
//   • PAGE_TOURS[path] — per-page walks anchored to that page's real controls, shown
//     once per page (and replayable from the "?" button).

// A step with no `element` renders as a screen-centered modal in driver.js. Single step,
// so the runner shows no progress chrome — just a title, blurb, and Done.
export const SITE_WELCOME = {
  id: 'welcome',
  steps: [
    {
      popover: {
        title: 'Welcome to Global Perspectives',
        description:
          'AI-curated intelligence on world news. <b>Topics</b> is the live feed; <b>Threads</b> follows stories over time; <b>Economy</b> shows what the news is repricing; <b>Track Record</b> scores our predictions. Click the <b>?</b> in the top bar any time for a guided walkthrough of the page you’re on.',
      },
    },
  ],
};

export const SITE_INTRO = {
  id: 'site',
  steps: [
    {
      element: '[data-tour="nav-brand"]',
      popover: {
        title: 'Welcome to Global Perspectives',
        description: 'AI-curated intelligence on global news — clustered, summarized, and tracked over time. Here’s a 20-second tour of what’s where.',
        side: 'bottom', align: 'start',
      },
    },
    {
      element: '[data-tour="nav-/"]',
      popover: { title: 'Topics', description: 'The live feed — what’s happening right now, grouped into topics and summarized from many sources.', side: 'bottom', align: 'start' },
    },
    {
      element: '[data-tour="nav-/weekly"]',
      popover: { title: 'Threads', description: 'Stories followed over time as narratives, so you can see how a situation is developing rather than one-off headlines.', side: 'bottom', align: 'start' },
    },
    {
      element: '[data-tour="nav-/economy"]',
      popover: { title: 'Economy', description: 'What today’s news is repricing — an instrument-first view of the markets the headlines are moving.', side: 'bottom', align: 'start' },
    },
    {
      element: '[data-tour="nav-/track-record"]',
      popover: { title: 'Track Record', description: 'Every prediction we publish is logged with a deadline and scored as it comes due — our forecasting accountability.', side: 'bottom', align: 'start' },
    },
    {
      element: '[data-tour="nav-help"]',
      popover: { title: 'Replay any time', description: 'Stuck? Click here on any page to replay the guide for the page you’re on.', side: 'bottom', align: 'end' },
    },
  ],
};

const ECONOMY_TOUR = {
  id: 'economy',
  // Auto-run waits for this anchor to exist (data loaded) before starting.
  readyAnchor: '.ep-lhd',
  steps: [
    {
      element: '.ep-briefing-band',
      popover: { title: 'Today in the economy', description: 'A plain-English synthesis of the day’s moves, composed from the same data shown below — start here for the gist.', side: 'bottom', align: 'start' },
    },
    {
      element: '.ep-lhd',
      popover: { title: 'Repricing today', description: 'Every market instrument that today’s news threads are moving, most-cited first.', side: 'bottom', align: 'start' },
    },
    {
      element: '.ep-instr-row',
      popover: { title: 'How to read a row', description: 'Instrument, a direction arrow (↑/↓ — or · when the news is too ambiguous to call), today’s level, and how many stories cite it. Click a row to expand the stories driving it.', side: 'bottom', align: 'start' },
    },
    {
      element: '.ep-rail-left',
      popover: { title: 'Filter the view', description: 'Narrow by severity, time horizon, or country. Your selection is saved in the URL, so a filtered view is shareable and survives a refresh.', side: 'right', align: 'start' },
    },
  ],
};

export const PAGE_TOURS = {
  '/economy': ECONOMY_TOUR,
};

// Resolve the page tour for a pathname (supports nested routes via prefix match).
export function pageTourForPath(pathname) {
  if (PAGE_TOURS[pathname]) return PAGE_TOURS[pathname];
  for (const [path, tour] of Object.entries(PAGE_TOURS)) {
    if (pathname === path || pathname.startsWith(path + '/')) return tour;
  }
  return null;
}
