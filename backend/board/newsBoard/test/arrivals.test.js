const test=require('node:test');
const assert=require('node:assert/strict');
const {arrivals}=require('../src/arrivals');
const board={createdAt:'2026-10-10T12:00:00Z',lastVisitedAt:'2026-10-18T08:00:00Z',dismissed:[],pins:[{pinId:'p1',kind:'thread',refId:'old'}]};
const row=id=>({id,born:'2026-10-19',line:`Recorded ${id}`,actors:['Iran'],countries:['IRN']});
const records={index:async()=>({stories:[row('old'),...Array.from({length:8},(_,i)=>row(`new-${i}`))]}),story:async id=>({threadId:id,links:[{otherThreadId:'old',confirmed:true,strength:'strong',mechanism:'Recorded mechanism'}]})};
test('arrivals require a strong confirmed link plus cheap grounds, cap five and remember dismissals',async()=>{
 const out=await arrivals({...board,dismissed:['new-0']},records,'2026-10-20');
 assert.equal(out.arrivals.length,5);assert.equal(out.arrivals[0].threadId,'new-1');assert.equal(out.arrivals[0].strength,'strong');assert.equal(out.arrivals[0].via[0].grounds.length,2);
 const weak={...records,story:async()=>({links:[{otherThreadId:'old',confirmed:false,strength:'strong'}]})};
 assert.equal((await arrivals(board,weak,'2026-10-20')).arrivals.length,0);
});
test('missing record, births before the visit day and future stories never invent arrivals; the visit day counts',async()=>{
 assert.deepEqual(await arrivals(board,{index:async()=>null},'2026-10-20'),{recordAvailable:false,since:board.lastVisitedAt,arrivals:[]});
 assert.equal((await arrivals({...board,lastVisitedAt:'2026-10-20T00:00:00Z'},records,'2026-10-20')).arrivals.length,0);
 assert.equal((await arrivals({...board,lastVisitedAt:'2026-10-19T23:00:00Z'},records,'2026-10-20')).arrivals.length,5);
 assert.equal((await arrivals(board,records,'2026-10-18')).arrivals.length,0);
});
