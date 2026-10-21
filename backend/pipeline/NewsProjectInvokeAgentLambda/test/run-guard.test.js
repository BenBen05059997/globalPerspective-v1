'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { staleReason } = require('../src/run-guard');
const now = new Date('2026-10-20T04:25:00Z');
const staging = (at) => ({ id:'staging', generationId:`gen-${Date.parse(at)}`, updatedAt:at, topics:[{id:'one',title:'Test event',regions:[],sources:[{url:'https://example.com/news'}]}] });
test('freshness rejects prior-day, previously archived, absent and invalid generations', () => {
 assert.equal(staleReason(staging('2026-10-19T20:15:00Z'),[],now),'generation-prior-day');
 assert.equal(staleReason(staging('2026-10-20T04:15:00Z'),[{updatedAt:'2026-10-20T04:26:00Z'}],now),'generation-already-archived');
 assert.equal(staleReason({...staging('2026-10-20T04:15:00Z'),id:'latest'},[],now),'staging-missing');
 assert.equal(staleReason({id:'staging'},[],now),'generation-time-missing');
 assert.equal(staleReason(staging('2026-10-20T04:15:00Z'),[{updatedAt:'2026-10-19T20:26:00Z'}],now),null);
});
function harness(item, archive = null, cached = false) {
 const calls=[],logs=[];
 const client = {send:async(command)=>{
  calls.push(command);
  if(cached && command.kind==='UpdateCommand' && command.input.TableName==='SummarizeAndPredict') return {};
  if(command.kind!=='GetCommand') throw new Error('unexpected write: '+command.kind);
  if (cached && command.input.Key.PK === 'TOPIC#one') return {Item:{PK:'TOPIC#one',SK:'SUMMARY',content:'Cached summary',topicId:'one',sourceFingerprint:require('../src/lib').sourceFingerprint(item.topics[0]),generatedAt:now.toISOString()}};
  const id=command.input.Key.id;
  if(id==='staging')return{Item:item};
  if(id==='today-archive')return{Item:archive};
  return{};
 }};
 const commands=Object.fromEntries(['PutCommand','GetCommand','ScanCommand','BatchWriteCommand','BatchGetCommand','QueryCommand','UpdateCommand'].map(kind=>[kind,class {constructor(input){this.kind=kind;this.input=input;}}]));
 const realRequire=createRequire(require.resolve('../src/index.js'));
 class Clock extends Date {constructor(...args){super(...(args.length?args:[now.toISOString()]));}static now(){return now.getTime();}}
 const sandbox={exports:{},require:name=>name==='@aws-sdk/client-dynamodb'?{DynamoDBClient:class{}}:name==='@aws-sdk/lib-dynamodb'?{...commands,DynamoDBDocumentClient:{from:()=>client}}:realRequire(name),process:{env:{TOPICS_DDB_TABLE:'NewsCache',SUMMARIZE_PREDICT_TABLE:'SummarizeAndPredict',CACHE_CLEANUP_ENABLED:'false'}},Date:Clock,console:Object.fromEntries(['log','warn','error','info'].map(k=>[k,(...args)=>logs.push(args.join(' '))])),setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/index.js'),'utf8'),sandbox);
 return {handler:sandbox.exports.handler,calls,logs};
}
test('handler rejects stale staging even with force, before any model or store write',async()=>{
 const h=harness(staging('2026-10-19T20:15:00Z'));
 const r=await h.handler({force:true});
 assert.equal(r.statusCode,503);assert.equal(JSON.parse(r.body).staleReason,'generation-prior-day');
 assert.ok(h.calls.every(c=>c.kind==='GetCommand'));
 assert.ok(h.logs.some(l=>l.includes('[pipeline-status]')&&l.includes('stale-staging')));
});
test('handler with zero generated returns failure marker and never archives or swaps',async()=>{
 const h=harness(staging('2026-10-20T04:15:00Z'));
 const r=await h.handler({});const body=JSON.parse(r.body);
 assert.equal(r.statusCode,503);assert.equal(body.reason,'zero-generated');assert.equal(body.generated,0);
 assert.ok(h.calls.every(c=>c.kind==='GetCommand'));
 assert.ok(h.logs.some(l=>l.includes('[pipeline-status]')&&l.includes('zero-generated')));
 assert.equal(h.logs.filter(l=>l.startsWith('[join]')).length,1);
});
test('readOnly cache inspection bypasses freshness but performs no writes',async()=>{
 const h=harness(staging('2026-10-19T20:15:00Z'));
 const r=await h.handler({readOnly:true,action:'summary'});
 assert.equal(r.statusCode,200);assert.ok(h.calls.every(c=>c.kind==='GetCommand'));
});

test('cache-only run emits zero-generated failure without latest/archive writes',async()=>{
 const h=harness(staging('2026-10-20T04:15:00Z'),null,true);
 const r=await h.handler({action:'summary'});const body=JSON.parse(r.body);
 assert.equal(body.reason,'zero-generated');assert.equal(body.reused,1);
 assert.ok(h.calls.every(c=>c.kind==='GetCommand'||(c.kind==='UpdateCommand'&&c.input.TableName==='SummarizeAndPredict')));
});

test('processed staging from before the current slot throws a structured stale error',async()=>{
 const h=harness({...staging('2026-10-19T20:15:00Z'),agentProcessedAt:'2026-10-19T20:40:00Z'});
 await assert.rejects(h.handler({}),/stale-processed-staging.*gen-\d+.*age 490m/);
 assert.ok(h.logs.some(l=>l.includes('[pipeline-status]')&&l.includes('stale-processed-staging')&&l.includes('ageMinutes')));
 assert.ok(h.calls.every(c=>c.kind==='GetCommand'));
});
test('processed staging from the current slot is a quiet skip',async()=>{
 const h=harness({...staging('2026-10-20T04:16:00Z'),agentProcessedAt:'2026-10-20T04:26:00Z'});
 const r=await h.handler({});
 assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).skipped,'staging-already-processed');
});
test('staleProcessedRun slot boundaries',()=>{
 const {staleProcessedRun}=require('../src/run-guard');
 assert.equal(staleProcessedRun(staging('2026-10-20T04:14:00Z'),now).ageMinutes,11);
 assert.equal(staleProcessedRun(staging('2026-10-20T04:15:00Z'),now),null);
 assert.equal(staleProcessedRun(staging('2026-10-20T03:00:00Z'),new Date('2026-10-20T12:25:00Z')).slotStart,'2026-10-20T12:15:00.000Z');
});
