'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function load({verdicts=['OK'],httpFailure=false,missingSummary=false}={}) {
 const sent=[],logs=[];let index=0;const topics=verdicts.map((_,i)=>({id:'t'+i,title:'Topic '+i,sources:[{source:'example.com',snippet:'Grounded article text',url:'https://example.com/article'}]}));
 const exports={};
 const context={exports,console:{log:(...a)=>logs.push(a.join(' ')),error:(...a)=>logs.push(a.join(' '))},process:{env:{PROXY_ENDPOINT:'https://proxy.invalid',SNS_TOPIC_ARN:'arn:test'}},AbortSignal,
  require:name=>name==='./_shared/llm'?{chat:async()=>{const v=verdicts[index++];if(v instanceof Error)throw v;return{content:v};}}:{SNSClient:class{async send(command){sent.push(command.input);}},PublishCommand:class{constructor(input){this.input=input;}}},
  fetch:async(url,init)=>{
   if(url!=='https://proxy.invalid')return{ok:false};
   const action=JSON.parse(init.body).action;
   if(httpFailure)return{ok:false,status:503};
   return{ok:true,json:async()=>action==='topics'?{data:{topics}}:{data:{content:missingSummary?'':'A summary'}}};
  }};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/index.js'),'utf8'),context);
 return{handler:exports.handler,sent,logs};
}
test('provider failure is an audit-error, not drift, and later topics still audited',async()=>{
 const f=load({verdicts:[new Error('LLM 402: Insufficient Balance'),'OK','Unsupported result']});
 const r=await f.handler();assert.equal(r.checked,3);assert.equal(r.audited,2);assert.equal(r.drift,1);assert.equal(r.auditErrors,1);assert.equal(r.ok,false);
 assert.equal(f.sent.length,1);assert.match(f.sent[0].Subject,/1 drift, 1 audit errors/);
 assert.ok(f.logs.some(l=>l.includes('AUDIT_ERROR')));assert.ok(f.logs.some(l=>l.includes('[pipeline-status]')));
});
test('missing summary cannot be called drift and empty work is a successful skip',async()=>{
 const f=load({missingSummary:true});const r=await f.handler();assert.equal(r.drift,0);assert.equal(r.auditErrors,1);
 const empty=load({verdicts:[]});assert.equal((await empty.handler()).skipped,'no-topics');
});
test('proxy failure propagates instead of pretending no topics',async()=>{
 await assert.rejects(load({httpFailure:true}).handler(),/HTTP 503/);
});
