'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {makeHandler}=require('./index');
const {normalizeClassified,cacheKey}=require('./classifier-core');
const NOW='2026-10-20T12:00:00.000Z';
const article=i=>({title:`Event ${i}`,url:`https://bbc.com/${i}`,source:'bbc.com',publishedAt:NOW});
const classified=a=>normalizeClassified({axis:'conflict',iso3:['UKR'],severity:4,latlon:[49,32],entities:['Actor']},a);
function harness({articles=Array.from({length:10},(_,i)=>article(i)), classify=async()=>{throw Error('simulated provider failure');},cache=null,apiKey='fake'}={}) {
 const prior={updated_at:'2026-10-20T10:00:00Z',count:1,stories:[{storyId:'conflict#UKR#actor',title:'Last good story'}]};
 const objects=new Map([['stories/index.json',prior],['stories/classify-cache.json',cache]]);const writes=[];
 const run=makeHandler({apiKey,now:()=>NOW,fetchRss:async()=>articles,fetchGdelt:async()=>[],classifyBatch:classify,getJson:async k=>objects.get(k)||null,putObj:async(k,v)=>{objects.set(k,v);writes.push(k);},putMetric:async()=>{}});
 return {run,objects,writes,prior};
}
test('classification outage marks output and stored index degraded, preserving last good snapshot',async()=>{
 const h=harness();const errors=[];const old=console.error;console.error=m=>errors.push(m);
 let result;try{result=await h.run();}finally{console.error=old;}
 assert.equal(result.ok,false);assert.equal(result.degraded,true);assert.equal(result.reason,'classification-outage');
 assert.equal(result.attempted,10);assert.equal(result.failedBatches,1);
 const index=h.objects.get('stories/index.json');assert.deepEqual(index.stories,h.prior.stories);assert.equal(index.updated_at,h.prior.updated_at);
 assert.equal(index.degraded,true);assert.ok(errors.some(l=>l.includes('[pipeline-status]')&&l.includes('classification-outage')));
 assert.ok(h.writes.every(k=>!k.startsWith('stories/state/')&&!k.startsWith('corpus/')));
});
test('mostly missing classifications count as failure even with a fulfilled model request',async()=>{
 const h=harness({classify:async batch=>batch.slice(0,4).map(classified)});
 assert.equal((await h.run()).degraded,true);
});
test('many cache hits cannot conceal outage on new headlines',async()=>{
 const articles=Array.from({length:10},(_,i)=>article(i));
 const cache={entries:Object.fromEntries(articles.slice(0,9).map(a=>[cacheKey(a),{at:NOW,c:classified(a)}]))};
 const h=harness({articles,cache});const result=await h.run();
 assert.equal(result.cached,9);assert.equal(result.attempted,1);assert.equal(result.ok,false);
});
test('healthy input clears degraded marker; a legitimate empty significant-story set is successful',async()=>{
 const h=harness({classify:async batch=>batch.map(a=>normalizeClassified({severity:1},a))});
 const r=await h.run();assert.equal(r.ok,true);assert.equal(r.stories,0);
 const index=h.objects.get('stories/index.json');assert.equal(index.degraded,false);assert.equal(index.status,'ok');assert.deepEqual(index.stories,[]);
});
test('all-cache healthy run needs no classification call',async()=>{
 const a=article(1);const cache={entries:{[cacheKey(a)]:{at:NOW,c:classified(a)}}};
 const h=harness({articles:[a],cache});assert.equal((await h.run()).ok,true);
});
test('no feeds and missing API key also publish explicit failure markers',async()=>{
 for(const options of [{articles:[]},{apiKey:''}]) {
  const h=harness(options);const r=await h.run();assert.equal(r.ok,false);assert.equal(h.objects.get('stories/index.json').degraded,true);
 }
});

test('partial numbered model output is counted once and never assigned to another headline',async()=>{
 const {_internal:{classifyBatch}}=require('./index');
 const articles=Array.from({length:10},(_,i)=>article(i));
 const rows=[2,3,4,5].map(n=>({n,axis:'conflict',iso3:['UKR'],severity:3}));
 const result=await classifyBatch(articles,async()=>({content:JSON.stringify({articles:rows})}));
 assert.equal(result.length,4);assert.deepEqual(result.map(r=>r.url),articles.slice(1,5).map(a=>a.url));
 for (const content of ['invalid json',JSON.stringify({articles:[{},{}]})]) {
  const empty=await classifyBatch(articles,async()=>({content}));assert.equal(empty.length,0);
 }
});
