'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {createRequire}=require('node:module');
function load({empty=false,readFailure=false,publishFailure=false,badOutput=false}={}) {
 const logs=[],writes=[];const exports={};const module={exports};const actual=createRequire(require.resolve('../src/index.js'));
 const entry={topicId:'topic',threadId:'thread-test',title:'Grounded event',archivedAt:new Date().toISOString(),regions:[],sources:[]};
 const client={send:async c=>{
  if(c.kind==='PutCommand'){writes.push(c.input);if(publishFailure)throw new Error('publish failed');return{};}
  if(readFailure)throw new Error('read failed');
  return c.input.Key.id==='today-archive'&&!empty?{Item:{entries:[entry]}}:{};
 }};
 const commands=Object.fromEntries(['GetCommand','PutCommand'].map(kind=>[kind,class{constructor(input){this.kind=kind;this.input=input;}}]));
 const context={exports,module,process:{env:{TOPICS_DDB_TABLE:'topics',SUMMARIZE_PREDICT_TABLE:'summary',XAI_API_KEY:'dummy-test-key'}},console:{log:(...a)=>logs.push(a.join(' ')),warn:(...a)=>logs.push(a.join(' ')),error:(...a)=>logs.push(a.join(' '))},
  require:name=>name==='@aws-sdk/client-dynamodb'?{DynamoDBClient:class{}}:name==='@aws-sdk/lib-dynamodb'?{...commands,DynamoDBDocumentClient:{from:()=>client}}:name==='./_shared/llm'?{stripCodeFence:v=>v,chat:async()=>({content:JSON.stringify({signals:badOutput?[]:[{threadId:'thread-test',lede:'Headline',fact:'Reported event'}]})})}:actual(name)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/index.js'),'utf8'),context);
 return{handler:exports.handler,logs,writes};
}
test('publish failure rejects and produces a failed-run marker',async()=>{
 const f=load({publishFailure:true});await assert.rejects(f.handler(),/publish failed/);assert.equal(f.writes.length,1);assert.ok(f.logs.some(l=>l.includes('[pipeline-status]')));
});
test('read failures and unusable output reject; no archive entries is normal skip',async()=>{
 await assert.rejects(load({readFailure:true}).handler(),/read failed/);
 await assert.rejects(load({badOutput:true}).handler(),/No usable signals/);
 const f=load({empty:true});assert.equal((await f.handler()).skipped,'no-archive-entries');assert.equal(f.writes.length,0);
});
