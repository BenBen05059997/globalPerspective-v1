'use strict';
const {cheapGrounds} = require('./_shared/record');
const {resolveIso3} = require('./_shared/resolveIso3');
const MAX_CANDIDATES = 40;
// The index has no title field: use its recorded line, never invent a headline.
async function arrivals(board, records, now) {
  const index = await records.index();
  const since = board.lastVisitedAt || board.createdAt;
  if (!index) return {recordAvailable:false, since, arrivals:[]};
  const pinned = new Set(board.pins.filter(p=>p.kind==='thread').map(p=>p.refId));
  const rows = new Map(index.stories.map(r=>[r.id,r]));
  // Births are day-precise, so the visit day itself is included: a story born later that day would otherwise never show.
  // Newest first and capped, so a long-dormant board does not fetch its whole backlog.
  const candidates = index.stories
    .filter(r=>r.born >= since.slice(0,10) && r.born <= now.slice(0,10) && !pinned.has(r.id) && !board.dismissed.includes(r.id))
    .sort((a,b)=>b.born.localeCompare(a.born)||a.id.localeCompare(b.id)).slice(0, MAX_CANDIDATES);
  const stories = await Promise.all(candidates.map(r=>records.story(r.id)));
  const cards=[];
  for (const [i, row] of candidates.entries()) {
    const story = stories[i];
    if (!story) continue;
    const dataOf = p => {
      if(p.kind==='thread') {const r=rows.get(p.refId);return {actors:r?.actors || [], places:r?.countries || []};}
      if(p.kind==='actor')return {actors:[p.refId],places:[]};
      const c=resolveIso3(p.refId);return {actors:c?[c.name]:[],places:c?[c.iso3]:[]};
    };
    const ctx={actorsOf:p=>dataOf(p).actors,placesOf:p=>dataOf(p).places,outletsOf:()=>[],scoresOf:()=>[]};
    const via=[];
    for(const pin of board.pins) {
      const grounds=cheapGrounds({kind:'thread',refId:row.id},pin,ctx);
      const link=pin.kind==='thread' && story.links?.find(l=>l.otherThreadId===pin.refId && l.confirmed===true && l.strength==='strong');
      if(link && grounds.strength!=='none')via.push({pinId:pin.pinId,threadId:pin.refId,mechanism:link.mechanism,grounds:grounds.grounds});
    }
    if(via.length)cards.push({threadId:row.id,title:row.line || null,date:row.born,strength:'strong',via});
  }
  return {recordAvailable:true,since,arrivals:cards.sort((a,b)=>b.date.localeCompare(a.date)||a.threadId.localeCompare(b.threadId)).slice(0,5)};
}
module.exports={arrivals};
