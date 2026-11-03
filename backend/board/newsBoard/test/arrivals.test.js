const test=require('node:test');
const assert=require('node:assert/strict');
const {arrivals}=require('../src/arrivals');
const board={createdAt:'2026-10-10T12:00:00Z',lastVisitedAt:'2026-10-18T08:00:00Z',dismissed:[],pins:[{pinId:'p1',kind:'thread',refId:'old'},{pinId:'p2',kind:'actor',refId:'Iran'}]};
const row=(threadId,extra={})=>({threadId,born:'2026-10-19',lastFactAt:'2026-10-19',title:`Title ${threadId}`,aliasOf:null,...extra});
const strong={otherThreadId:'old',direction:'drives',week:'2026-W43',cites:[],mechanism:'Recorded mechanism'};
const shared={otherThreadId:'old',sharedActorIds:['a1'],sharedIso3:['IRN'],sharedSourceIds:[],grounds:2};
function fakeRecords(linksOf){const calls=[];return {calls,records:{active:async()=>({stories:[row('old'),...Array.from({length:8},(_,i)=>row(`new-${i}`))]}),
  links:async id=>{calls.push(id);return linksOf(id);}}};}
const withLinks=()=>({confirmedLinks:[strong],links:[shared]});
test('arrivals need a confirmed strong link plus shared grounds, cap five, remember dismissals, use row titles',async()=>{
 const {records,calls}=fakeRecords(withLinks);
 const out=await arrivals({...board,dismissed:['new-0']},records,'2026-10-20');
 assert.equal(out.arrivals.length,5);assert.equal(out.arrivals[0].threadId,'new-1');assert.equal(out.arrivals[0].title,'Title new-1');
 assert.deepEqual(out.arrivals[0].via,[{pinId:'p1',threadId:'old',mechanism:'Recorded mechanism',direction:'drives',grounds:['actors','places']}]);
 assert.ok(!calls.includes('old')&&!calls.includes('new-0'));
});
test('step 2 links views have no confirmedLinks: no cards, and no per-story record GETs beyond links',async()=>{
 const {records}=fakeRecords(()=>({links:[shared],confirmedLinks:[],confirmedLinksReason:'no reading yet'}));
 assert.deepEqual((await arrivals(board,records,'2026-10-20')).arrivals,[]);
 const none=fakeRecords(()=>null);assert.deepEqual((await arrivals(board,none.records,'2026-10-20')).arrivals,[]);
 const ungrounded=fakeRecords(()=>({confirmedLinks:[strong],links:[{...shared,grounds:0}]}));assert.deepEqual((await arrivals(board,ungrounded.records,'2026-10-20')).arrivals,[]);
});
test('missing index, future stories and aliases never invent arrivals; a visit does not hide a card',async()=>{
 const {records}=fakeRecords(withLinks);
 assert.deepEqual(await arrivals(board,{active:async()=>null},'2026-10-20'),{recordAvailable:false,since:'2026-10-07',lastVisitedAt:board.lastVisitedAt,arrivals:[]});
 assert.equal((await arrivals({...board,lastVisitedAt:'2026-10-20T00:00:00Z'},records,'2026-10-20')).arrivals.length,5);
 assert.equal((await arrivals(board,records,'2026-10-18')).arrivals.length,0);
 const alias={active:async()=>({stories:[row('old'),row('merged',{aliasOf:'x'})]}),links:async()=>withLinks()};
 assert.equal((await arrivals(board,alias,'2026-10-20')).arrivals.length,0);
});
test('the pool is a 14-day window: a card seen Tuesday is still there Thursday; only `unseen` follows the last visit',async()=>{
 const {records}=fakeRecords(withLinks);
 const visited={...board,lastVisitedAt:'2026-10-21T08:00:00Z'};
 const thu=await arrivals(visited,records,'2026-10-23');
 assert.equal(thu.arrivals.length,5);
 assert.ok(thu.arrivals.every(c=>c.unseen===false),'born 19 Oct, visit 21 Oct: already seen');
 assert.equal(thu.since,'2026-10-10');
 const fresh=await arrivals({...board,lastVisitedAt:'2026-10-18T08:00:00Z'},records,'2026-10-23');
 assert.ok(fresh.arrivals.every(c=>c.unseen===true));
 assert.equal((await arrivals(visited,records,'2026-11-02')).arrivals.length,0,'older than 14 days: aged out');
 assert.equal((await arrivals(visited,records,'2026-11-01')).arrivals.length,5,'the 14th day still counts (19 Oct + 13 days)');
});
