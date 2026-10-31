// DEV ONLY. A board that shows every element of the graph view (artboard 1) in the dev harness: pins of each kind
// with crisis type, risk, "was" score, line and counts, strings of every strength and owner, a story born this
// week, a day with no coverage and the weeks a scrubber can step through. fakeBoardApi serves it for
// `?devBoard=1&devRecord=1`. Nothing here ships in a production build (fakeBoardApi is a dynamic import behind DEV).
//
// Two more elements come from tests you run: connect "Ship attacks near Hormuz" with "Trump's Russia sanctions pause"
// (they share "oil price", which you do not follow: a suggested pin and a "Suggested" string) and connect "Sudan
// gold-mine airstrikes" with "Albanian protests" (no link: a "Combination failed" string).
import { isoWeekEnd } from '../lib/recordViews.js';
import { dayMonth } from '@/shared/lib/branchWording.js';

export const DEV_GRAPH_ID = 'dev-graph';
const DAY = 86400000;
const iso = (t) => new Date(t).toISOString();

// pinId -> what the board feed would carry for the pin (title, crisis type, risk, readings, counts).
const PINS = [
  { pinId: 'p01', kind: 'thread', refId: 'dev-hormuz', title: 'Ship attacks near Hormuz', category: 'conflict', risk: 88, line: 'Attacks on shipping keep the strait one incident from closing.', counts: { chapters: 4, liveBranches: 3, confirmedLinks: 1 }, actors: ['Oil price', 'Iran'], iso3: ['IRN'] },
  { pinId: 'p02', kind: 'thread', refId: 'dev-sanctions', title: "Trump's Russia sanctions pause", category: 'politics', risk: 78, line: null, counts: { chapters: 2, liveBranches: 1, confirmedLinks: null }, actors: ['Oil price', 'Trump'], iso3: ['USA', 'RUS'] },
  { pinId: 'p03', kind: 'country', refId: 'USA', risk: 85, riskWas: 95 },
  { pinId: 'p04', kind: 'thread', refId: 'dev-houthi', title: 'Saudi Arabia and Yemen: Houthi campaign', quietDays: 35, category: 'conflict', risk: 92, line: null, counts: { chapters: 5, liveBranches: 2, confirmedLinks: 2 }, actors: ['Oil price', 'Houthis'], iso3: ['SAU', 'YEM'] },
  { pinId: 'p05', kind: 'thread', refId: 'dev-sudan', title: 'Sudan gold-mine airstrikes', category: 'conflict', risk: 85, line: null, counts: null, actors: ['RSF'], iso3: ['SDN'] },
  { pinId: 'p06', kind: 'thread', refId: 'dev-ethiopia', title: 'Ethiopia–Eritrea tension', category: 'conflict', risk: 80, line: null, counts: null, actors: ['TPLF'], iso3: ['ETH', 'ERI'] },
  { pinId: 'p07', kind: 'thread', refId: 'dev-albania', title: 'Albanian protests', category: 'politics', risk: 60, line: null, counts: null, bornDaysAgo: 2, actors: ['Rama'], iso3: ['ALB'] },
  { pinId: 'p08', kind: 'actor', refId: 'Iran' },
];

/** What the fake's connect test knows about a dev-graph thread pin: { actors, iso3 } or undefined. */
export const devGraphFacts = (refId) => PINS.find((p) => p.refId === refId && p.kind === 'thread');

export function devGraphBoard(nowIso) {
  return {
    boardId: DEV_GRAPH_ID, uid: 'dev-member', name: 'Gulf and the Horn',
    pins: PINS.map(({ pinId, kind, refId }) => ({ pinId, kind, refId, addedAt: nowIso })),
    strings: [
      { a: 'p01', b: 'p02', owner: 'ours', strength: 'medium', mechanism: 'oil price pressure on Washington', confirmed: false },
      { a: 'p01', b: 'p03', owner: 'ours', strength: 'strong', mechanism: 'Trump ruled out strikes on Iran before the midterms', keptAt: nowIso },
      { a: 'p01', b: 'p04', owner: 'ours', strength: 'weak', mechanism: 'shared actors and shipping lane' },
      { a: 'p05', b: 'p06', owner: 'yours', line: "Both are Egypt's periphery; watch Cairo", keptAt: nowIso },
      { a: 'p01', b: 'p07', owner: 'yours', cutAt: nowIso, keptAt: nowIso },
      { a: 'p01', b: 'p08', owner: 'ours', strength: 'inferred', mechanism: 'Shared actors: Iran' },
    ],
    weights: {}, dismissed: [], summary: { versions: [
      { text: 'The Gulf pins held steady. Sudan stayed untested.', writtenAt: iso(Date.parse(nowIso) - 21 * DAY) },
      { text: 'Hormuz strengthened against Washington. Nothing moved in the Horn.', writtenAt: iso(Date.parse(nowIso) - 14 * DAY) },
      { text: 'You follow seven pins around the Gulf and the Horn. The first half strengthened.', writtenAt: iso(Date.parse(nowIso) - 7 * DAY) },
    ] }, createdAt: nowIso, updatedAt: nowIso,
  };
}

/** The board as the feed would serve it: pins carry their record fields, and the board carries its coverage. */
export function decorateDevGraph(board, now = new Date()) {
  const byId = Object.fromEntries(PINS.map((p) => [p.pinId, p]));
  const weekEnd = isoWeekEnd(iso(now).slice(0, 10));
  const gap = iso(now.getTime() - 3 * DAY).slice(0, 10);
  return {
    ...board,
    recordAvailable: true,
    pins: board.pins.map((pin) => {
      const d = byId[pin.pinId];
      if (!d) return pin;
      return {
        ...pin, recordAvailable: true, ...(d.title ? { title: d.title } : {}), ...(d.category ? { category: d.category } : {}),
        ...(d.risk != null ? { risk: d.risk } : {}), ...(d.riskWas != null ? { riskWas: d.riskWas } : {}),
        line: d.line ?? null, ...(d.counts ? { counts: d.counts } : {}),
        ...(d.quietDays != null ? { lastMoved: iso(now.getTime() - d.quietDays * DAY).slice(0, 10) } : {}),
        ...(d.bornDaysAgo != null ? { born: iso(now.getTime() - d.bornDaysAgo * DAY).slice(0, 10) } : {}),
      };
    }),
    coverage: {
      gaps: [{ date: gap, note: 'no archive for that day' }],
      weeks: [4, 3, 2, 1, 0].map((n) => iso(Date.parse(weekEnd) - n * 7 * DAY).slice(0, 10)),
      note: `No archive for ${dayMonth(gap)} · 14 of 59 new stories analysed`,
    },
  };
}
