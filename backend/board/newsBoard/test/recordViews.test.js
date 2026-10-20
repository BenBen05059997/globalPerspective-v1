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
