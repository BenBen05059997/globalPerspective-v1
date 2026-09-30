// linkStates — the honest "no links" wording for a story, chosen from the index's own `state`
// (never guessed). Every empty state ends with the refresh line: the real date of the last run.
import { fmtDay } from '@/features/track-record/lib/trFormatDate.js';

const DAY = 86400000;
const STALE_DAYS = 2;

function refreshLine(index) {
  const last = index?.generatedAt ? fmtDay(index.generatedAt) : null;
  return last
    ? `Links are refreshed by a daily job. Last refresh: ${last}. A new link can only appear after the next one.`
    : 'Links are refreshed by a daily job. A new link can only appear after the next one.';
}

/**
 * @param {{index:object|null, state:string|null, meta:object|null, now?:number}} a
 * @returns {{lines:string[], key:string}|null}  null while nothing is known yet (no empty state is shown)
 */
export function linkNote({ index, state, meta, now = Date.now() }) {
  if (state === 'linked') return null;
  const lead = 'No linked stories found yet for this story.';
  const lines = [];
  let key = state || 'unknown';
  if (state === 'no_index') {
    return { key: 'no_index', lines: ['Story links have not been built yet.', 'Links are refreshed by a daily job; a new link can only appear after it has run.'] };
  }
  if (state === 'single_update') {
    lines.push(`${lead} It has one update so far; stories are checked for links once they have two or more.`);
  } else if (state === 'country_not_analysed') {
    const place = meta?.places?.[0]?.name;
    const n = index?.targets?.count;
    lines.push(`${lead} Story links are built for the ${n ? `${n} ` : ''}most-covered countries in each run; ${place || 'its country'} was not among them last time.`);
  } else if (state === 'analysed_no_links') {
    const a = meta?.analysedIn?.[0];
    const web = a && (index?.websUsed || []).find((w) => w.country === a.country);
    const others = web && web.nodes > 1 ? ` together with ${web.nodes - 1} other stor${web.nodes - 1 === 1 ? 'y' : 'ies'} in ${a.country}` : (a ? ` in ${a.country}` : '');
    lines.push(`${lead} It was checked on ${a ? fmtDay(a.generatedAt) : 'the last run'}${others}; none met our evidence bar (a named mechanism and at least one cited news item).`);
  } else {
    key = 'unknown';
    lines.push(`${lead} It is not part of the current link analysis (it has had no recent updates).`);
  }
  if (index?.generatedAt && now - Date.parse(index.generatedAt) > STALE_DAYS * DAY) {
    lines.push(`Story links have not been refreshed since ${fmtDay(index.generatedAt)}.`);
  }
  lines.push(refreshLine(index));
  return { key, lines };
}
