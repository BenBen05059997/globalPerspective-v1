'use strict';
const {rowsOf} = require('./recordViews');
const MAX_CANDIDATES = 40;
const WINDOW_DAYS = 14; // a story is a candidate for this many UTC days after it is born, the day it is born included
const DAY = 86400000;
// Candidates come from the active index rows (title is a fact, the first entry's title); grounds and confirmed links
// from links/{id}.json. No per-story GETs. Cards come only from the weekly reading's confirmedLinks (none until it runs).
async function arrivals(board, records, now) {
  const rows = rowsOf(await records.active());
  // The pool is a fixed window, not "since the last visit": a card left untouched stays until it is kept, dismissed or ages out.
  // lastVisitedAt only says which cards are new to the reader (`unseen`).
  const since = new Date(Date.parse(now.slice(0,10)) - (WINDOW_DAYS-1)*DAY).toISOString().slice(0,10);
  const visited = (board.lastVisitedAt || board.createdAt || '').slice(0,10);
  if (!rows) return {recordAvailable:false, since, lastVisitedAt:board.lastVisitedAt||null, arrivals:[]};
  const threadPins = board.pins.filter(p=>p.kind==='thread');
  const pinned = new Set(threadPins.map(p=>p.refId));
  // Births are day-precise, so the visit day itself is included: a story born later that day would otherwise never show.
  // Newest first and capped, so a long-dormant board does not fetch its whole backlog.
  const candidates = rows
    .filter(r=>!r.aliasOf && r.born >= since && r.born <= now.slice(0,10) && !pinned.has(r.threadId) && !board.dismissed.includes(r.threadId))
    .sort((a,b)=>b.born.localeCompare(a.born)||a.threadId.localeCompare(b.threadId)).slice(0, MAX_CANDIDATES);
  const views = await Promise.all(candidates.map(r=>records.links(r.threadId)));
  const cards=[];
  for (const [i, row] of candidates.entries()) {
    const view = views[i];
    if (!view) continue;
    const via=[];
    for(const pin of threadPins) {
      const confirmed=view.confirmedLinks?.find(l=>l.otherThreadId===pin.refId);
      const shared=view.links?.find(l=>l.otherThreadId===pin.refId);
      if(confirmed && shared?.grounds>0)via.push({pinId:pin.pinId,threadId:pin.refId,mechanism:confirmed.mechanism,direction:confirmed.direction,
        grounds:[['actors',shared.sharedActorIds],['places',shared.sharedIso3],['sources',shared.sharedSourceIds]].filter(([,l])=>l?.length).map(([k])=>k)});
    }
    if(via.length)cards.push({threadId:row.threadId,title:row.title || null,date:row.born,strength:'strong',unseen:row.born >= visited,via});
  }
  return {recordAvailable:true,since,lastVisitedAt:board.lastVisitedAt||null,arrivals:cards.sort((a,b)=>b.date.localeCompare(a.date)||a.threadId.localeCompare(b.threadId)).slice(0,5)};
}
module.exports={arrivals};
