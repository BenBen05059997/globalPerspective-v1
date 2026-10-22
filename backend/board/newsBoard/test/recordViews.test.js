const test = require('node:test');
const assert = require('node:assert/strict');
const {makeRecordViews, enrichBoard} = require('../src/recordViews');
const {createHandler} = require('../src');
const {fakeStore, validBoardBody, ENV} = require('./helpers');
class Command {constructor(input){this.input=input;}}
function fake(objects={}, error) {
  const keys=[];
  const records=makeRecordViews({bucket:'world',GetObjectCommand:Command,client:{send:async cmd=>{
    keys.push(cmd.input.Key); if(error)throw error;
    if(!(cmd.input.Key in objects))throw Object.assign(new Error('missing'),{name:'NoSuchKey'});
    return {Body:{transformToString:async()=>JSON.stringify(objects[cmd.input.Key])}};
  }}});return {records,keys};
}
const V='record/views/';
const row=(threadId,extra={})=>({threadId,born:'2026-10-19',lastFactAt:'2026-10-20',iso3:[],actorIds:[],sourceCount:1,entryCount:3,forkCount:1,branchCount:2,liveBranchCount:1,latestVerdictAt:null,aliasOf:null,title:`Title ${threadId}`,...extra});
test('missing view files are explicit; errors do not become missing; ids are validated',async()=>{
  const {records}=fake();assert.equal(await records.active(),null);assert.equal(await records.links('story-a'),null);
  const board=validBoardBody();const out=await enrichBoard(board,records);
  assert.equal(out.recordAvailable,false);assert.equal(out.pins[0].recordAvailable,false);assert.equal(out.pins[0].line,undefined);
  await assert.rejects(fake({},new Error('denied')).records.active(),/denied/);
  assert.throws(()=>records.links('../secret'),/Invalid/);
});
test('enrichment copies facts only: line null, risk omitted, chapters/links null, zero counts kept',async()=>{
  const board=validBoardBody();const {records,keys}=fake({[V+'index/active.json']:{stories:[row('thread-hormuz',{liveBranchCount:0,entryCount:0})]}});
  const out=await enrichBoard(board,records);const pin=out.pins[0];
  assert.equal(pin.recordAvailable,true);assert.equal(pin.line,null);assert.equal('risk' in pin,false);assert.equal(pin.born,'2026-10-19');assert.equal(pin.lastMoved,'2026-10-20');
  assert.deepEqual(pin.counts,{chapters:null,liveBranches:0,confirmedLinks:null});assert.equal(pin.entryCount,0);
  assert.equal(out.pins[1].recordAvailable,false);assert.equal(board.pins[0].line,undefined);
  assert.deepEqual(keys,[V+'index/active.json']);
});
test('pin.line is the index row line string when read, null when absent or empty',async()=>{
  const board=validBoardBody();
  const read=fake({[V+'index/active.json']:{stories:[row('thread-hormuz',{line:'Talks stall over transit rights.'})]}});
  assert.equal((await enrichBoard(board,read.records)).pins[0].line,'Talks stall over transit rights.');
  for(const line of [undefined,'',null,5]){
    const f=fake({[V+'index/active.json']:{stories:[row('thread-hormuz',{line})]}});
    const pin=(await enrichBoard(board,f.records)).pins[0];assert.equal(pin.line,null);assert.deepEqual(pin.counts,{chapters:null,liveBranches:1,confirmedLinks:null});
  }
});
test('a pinned story that is not active falls back to all.json once; an alias shows its survivor; active only when enough',async()=>{
  const board=validBoardBody();
  const {records,keys}=fake({[V+'index/active.json']:{stories:[row('other')]},[V+'index/all.json']:{stories:[row('other'),row('thread-hormuz',{lastFactAt:'2026-05-01',aliasOf:'other'})]}});
  const out=await enrichBoard(board,records);assert.equal(out.pins[0].lastMoved,'2026-10-20');assert.equal(keys.filter(k=>k.endsWith('all.json')).length,1);
  const only=fake({[V+'index/active.json']:{stories:[row('thread-hormuz')]}});
  await enrichBoard({...board,pins:[board.pins[0]]},only.records);assert.deepEqual(only.keys,[V+'index/active.json']);
});
test('story_view is gone: the board fetches stories/{id}.json directly',async()=>{
  const handler=createHandler({store:fakeStore(),verify:async()=>null,records:fake().records,env:ENV});
  const r=JSON.parse((await handler({body:{action:'story_view',threadId:'story-a'},headers:{}})).body);
  assert.equal(r.success,false);assert.equal(r.error,'Unsupported action');
});
test('get_board enriches owned pins only and update strips derived fields before storage',async()=>{
  const store=fakeStore();const {records}=fake({[V+'index/active.json']:{stories:[row('thread-hormuz')]}});
  const handler=createHandler({store,verify:async h=>h?{sub:h}:null,records,env:ENV});
  const call=async(uid,body)=>{const r=await handler({headers:{authorization:uid},body});return {status:r.statusCode,...JSON.parse(r.body)};};
  const created=(await call('u1',{action:'create_board',name:'Test'})).data;
  let saved=(await call('u1',{action:'update_board',boardId:created.boardId,board:{...created,...validBoardBody()}})).data;
  assert.equal(saved.pins[0].recordAvailable,true);assert.equal(saved.pins[0].entryCount,3);
  assert.equal((await call('u2',{action:'get_board',boardId:created.boardId})).status,404);
  await call('u1',{action:'update_board',boardId:created.boardId,board:saved});
  const stored=await store.getBoard('u1',created.boardId);
  for(const k of ['line','born','entryCount','counts','lastMoved','recordAvailable'])assert.equal(stored.pins[0][k],undefined,k);
  assert.equal(stored.recordAvailable,undefined);
  await call('u1',{action:'visit_board',boardId:created.boardId});assert.ok((await store.getBoard('u1',created.boardId)).lastVisitedAt);
});

test('visit writes only its timestamp, guarded against a deleted board',async()=>{
  const {makeStoreOn}=require('../src/store');const commands=[];
  const store=makeStoreOn(async c=>{commands.push(c.input);return {};},{UpdateCommand:Command},ENV);
  await store.setLastVisited('u1','b1','2026-10-20T12:00:00Z');
  assert.deepEqual(commands,[{TableName:'saved',Key:{uid:'u1',savedKey:'board#b1'},UpdateExpression:'SET lastVisitedAt = :stamp',ExpressionAttributeValues:{':stamp':'2026-10-20T12:00:00Z'},ConditionExpression:'attribute_exists(uid) AND attribute_exists(savedKey)'}]);
});
