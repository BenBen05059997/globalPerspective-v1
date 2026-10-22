'use strict';
const {rowsOf} = require('./recordViews');
const MAX_CANDIDATES = 40;
// Candidates come from the active index rows (title is a fact, the first entry's title); grounds and confirmed links
// from links/{id}.json. No per-story GETs. Cards come only from the weekly reading's confirmedLinks (none until it runs).
async function arrivals(board, records, now) {
  const rows = rowsOf(await records.active());
  const since = board.lastVisitedAt || board.createdAt;
  if (!rows) return {recordAvailable:false, since, arrivals:[]};
  const threadPins = board.pins.filter(p=>p.kind==='thread');
  const pinned = new Set(threadPins.map(p=>p.refId));
  // Births are day-precise, so the visit day itself is included: a story born later that day would otherwise never show.
  // Newest first and capped, so a long-dormant board does not fetch its whole backlog.
  const candidates = rows
    .filter(r=>!r.aliasOf && r.born >= since.slice(0,10) && r.born <= now.slice(0,10) && !pinned.has(r.threadId) && !board.dismissed.includes(r.threadId))
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
    if(via.length)cards.push({threadId:row.threadId,title:row.title || null,date:row.born,strength:'strong',via});
  }
  return {recordAvailable:true,since,arrivals:cards.sort((a,b)=>b.date.localeCompare(a.date)||a.threadId.localeCompare(b.threadId)).slice(0,5)};
}
module.exports={arrivals};
