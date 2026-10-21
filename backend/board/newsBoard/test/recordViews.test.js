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
test('missing record files are explicit; errors do not become missing',async()=>{
  const {records}=fake();assert.equal(await records.index(),null);assert.equal(await records.story('story-a'),null);
  const board=validBoardBody();const out=await enrichBoard(board,records);
  assert.equal(out.recordAvailable,false);assert.equal(out.pins[0].line,undefined);
  await assert.rejects(fake({},new Error('denied')).records.index(),/denied/);
  assert.throws(()=>records.story('../secret'),/Invalid/);
});
test('index enrichment is response-only and preserves zero counts',async()=>{
  const board=validBoardBody();const {records}=fake({'record/index.json':{stories:[{id:'thread-hormuz',line:'A dated read',risk:0,born:'2026-10-19',chapters:0,liveBranches:0,confirmedLinks:0,lastMoved:'2026-10-20'}]}});
  const out=await enrichBoard(board,records);assert.equal(out.pins[0].line,'A dated read');assert.equal(out.pins[0].counts.chapters,0);assert.equal(out.pins[1].recordAvailable,false);assert.equal(board.pins[0].line,undefined);
});
test('story_view is public, validates keys, and returns exact story or explicit absence',async()=>{
  const story={threadId:'story-a',events:[]};const {records,keys}=fake({'record/stories/story-a/latest.json':story});
  const handler=createHandler({store:fakeStore(),verify:async()=>null,records,env:ENV});
  const call=async body=>JSON.parse((await handler({body,headers:{}})).body);
  assert.deepEqual((await call({action:'story_view',threadId:'story-a'})).data,{recordAvailable:true,story});
  assert.deepEqual((await call({action:'story_view',threadId:'missing'})).data,{recordAvailable:false,story:null});
  assert.equal((await call({action:'story_view',threadId:'../bad'})).success,false);assert.equal(keys.length,2);
});

test('get_board enriches owned pins only and update strips derived fields before storage',async()=>{
  const store=fakeStore();const {records}=fake({'record/index.json':{stories:[{id:'thread-hormuz',line:'A recorded line',risk:50,born:'2026-10-19',chapters:0,liveBranches:1,confirmedLinks:0,lastMoved:'2026-10-19'}]}});
  const handler=createHandler({store,verify:async h=>h?{sub:h}:null,records,env:ENV});
  const call=async(uid,body)=>{const r=await handler({headers:{authorization:uid},body});return {status:r.statusCode,...JSON.parse(r.body)};};
  const created=(await call('u1',{action:'create_board',name:'Test'})).data;
  let saved=(await call('u1',{action:'update_board',boardId:created.boardId,board:{...created,...validBoardBody()}})).data;
  assert.equal(saved.pins[0].line,'A recorded line');
  assert.equal((await call('u2',{action:'get_board',boardId:created.boardId})).status,404);
  await call('u1',{action:'update_board',boardId:created.boardId,board:saved});
  const stored=await store.getBoard('u1',created.boardId);assert.equal(stored.pins[0].line,undefined);assert.equal(stored.recordAvailable,undefined);
  await call('u1',{action:'visit_board',boardId:created.boardId});assert.ok((await store.getBoard('u1',created.boardId)).lastVisitedAt);
});

test('exact lane C schema examples pass through record reads without filling blank fields',async()=>{
  const fs=require('node:fs');const path=require('node:path');
  const base=path.resolve(__dirname,'../../../../global-perspectives-starter/frontend/src/features/board/dev/recordExamples');
  const story=JSON.parse(fs.readFileSync(path.join(base,'valid-story.json')));
  const index=JSON.parse(fs.readFileSync(path.join(base,'valid-index.json')));
  const {records}=fake({'record/index.json':index,'record/stories/story-a/latest.json':story});
  assert.deepEqual(await records.story('story-a'),story);assert.equal((await records.index()).stories[0].line,'');
});

test('visit writes only its timestamp, guarded against a deleted board',async()=>{
  const {makeStoreOn}=require('../src/store');const commands=[];
  const store=makeStoreOn(async c=>{commands.push(c.input);return {};},{UpdateCommand:Command},ENV);
  await store.setLastVisited('u1','b1','2026-10-20T12:00:00Z');
  assert.deepEqual(commands,[{TableName:'saved',Key:{uid:'u1',savedKey:'board#b1'},UpdateExpression:'SET lastVisitedAt = :stamp',ExpressionAttributeValues:{':stamp':'2026-10-20T12:00:00Z'},ConditionExpression:'attribute_exists(uid) AND attribute_exists(savedKey)'}]);
});
