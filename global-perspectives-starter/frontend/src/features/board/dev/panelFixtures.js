// DEV ONLY. Fixtures that make the verdict, weekly and arrivals panels show every built element in the harness
// (`?devBoard=1&devRecord=1`). Dates are relative to today so the "last seven days" and "due this week" lists fill.
// Sample data only: titles and mechanisms here are never shown on the live site.
const DAY = 86400000;
export const dayFromNow = (n) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);

/** Connect reply for the two record fixture stories: every ground, including dated score moves for the joint trace. */
export function devVerdict(a, b) {
  return {
    pairKey: `${a.refId}|${b.refId}`,
    a, b,
    strength: 'medium',
    grounds: [
      { kind: 'actor', detail: ['iran', 'us navy'] },
      { kind: 'place', detail: ['IRN'] },
      { kind: 'outlet', detail: { outlets: ['Reuters', 'BBC'], note: 'coverage artefact possible' } },
      { kind: 'comovement', detail: { pairs: 1, lagDays: 2, note: 'one pairing is not a pattern', moves: { a: [dayFromNow(-4)], b: [dayFromNow(-2)] } } },
    ],
    note: 'Shared: actor + place. Shared outlets add nothing (coverage artefact possible).',
    limits: ['dev fixture: the co-movement rests on one pairing'],
  };
}

/** Arrivals reply cards for the dev-record board (pins p1 and p2). */
export function devArrivals() {
  return [
    { threadId: 'dev-arrival-1', title: 'Insurers weigh convoy escorts for Gulf tankers', date: dayFromNow(-1), strength: 'strong',
      via: [{ pinId: 'p1', threadId: 'story-a', mechanism: 'Escort talks follow the rerouting.', direction: 'driven_by' }, { pinId: 'p2', threadId: 'story-b', mechanism: 'Cover costs hinge on escorts.', direction: 'drives' }] },
    { threadId: 'dev-arrival-2', title: 'Port of Fujairah reports a backlog', date: dayFromNow(-2), strength: 'medium',
      via: [{ pinId: 'p1', threadId: 'story-a', mechanism: 'Diverted tankers queue at the nearest port.', direction: 'driven_by' }] },
    { threadId: 'dev-arrival-3', title: 'Freight rates on the Asia route climb', date: dayFromNow(-3), strength: 'strong',
      via: [{ pinId: 'p2', threadId: 'story-b', mechanism: 'Premiums feed freight rates.', direction: 'shared_cause' }] },
  ];
}

/** Open branches of the record fixtures are due within the week, and the confirmed link is current. */
export function rebaseStory(view, offsets) {
  if (!view?.forks) return view;
  let i = 0;
  return { ...view, forks: view.forks.map((f) => ({ ...f, branches: f.branches.map((b) => (b.verdict ? b : { ...b, due: dayFromNow(offsets[i++ % offsets.length]) })) })) };
}
