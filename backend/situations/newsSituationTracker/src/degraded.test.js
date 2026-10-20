'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {createRequire}=require('node:module');
const {_internal:{foldSweep}}=require('./index');
const NOW='2026-10-20T12:00:00.000Z';
const news={situationId:'news#conflict#UKR#actor',source:'news',state:'cooling',cooling_checks:2,closed_at:null,tier:'high',axis:'conflict',verb_label:'News event',opened_at:'2026-10-19T00:00:00Z',last_change_at:'2026-10-20T09:00:00Z',iso3_affected:['UKR'],history:[],centroid:{lat:49,lon:32}};
test('degraded news freezes prior state through repeated sweeps, including already closed rows',()=>{
 const closed={...news,situationId:'news#closed',state:'closed',closed_at:'2026-10-01T00:00:00Z'};
 let prior={[news.situationId]:news,[closed.situationId]:closed};
 for(let i=0;i<5;i++) {
  const r=foldSweep(prior,[],NOW,9999999999,{newsDegraded:true,closeAfter:3,keepHours:1});
  assert.equal(r.states[news.situationId],news);assert.equal(r.states[closed.situationId],closed);
  assert.equal(r.counts.cooled,0);assert.equal(r.counts.closed,0);assert.equal(r.changes.length,0);assert.equal(r.dropped.length,0);prior=r.states;
 }
});
test('healthy empty source still cools/closes news; GDACS remains independent during news outage',()=>{
 const normal=foldSweep({[news.situationId]:news},[],NOW,9999999999);
 assert.equal(normal.states[news.situationId].state,'closed');
 const gdacs={...news,situationId:'gdacs#FL#1',source:'gdacs'};
 const mixed=foldSweep({[news.situationId]:news,[gdacs.situationId]:gdacs},[],NOW,9999999999,{newsDegraded:true});
 assert.equal(mixed.states[news.situationId],news);assert.equal(mixed.states[gdacs.situationId].state,'closed');
});
function harness(index) {
 const objects=new Map([['stories/index.json',index],['situations/inbox/gdacs-latest.json',{events:[],observed_at:NOW}],['situations/index.json',{ids:[news.situationId]}],['situations/state/news_conflict_UKR_actor.json',news]]);
 const real=createRequire(require.resolve('./index.js'));
 class GetObjectCommand{constructor(input){this.input=input;this.get=true;}}
 class PutObjectCommand{constructor(input){this.input=input;}}
 const client={send:async c=>{const key=c.input.Key;if(c.get){if(!objects.has(key)){const e=Error('missing');e.name='NoSuchKey';throw e;}return {Body:{transformToString:async()=>JSON.stringify(objects.get(key))}};}objects.set(key,JSON.parse(c.input.Body));return {};}};
 const context={exports:{},require:n=>n==='@aws-sdk/client-s3'?{S3Client:class{constructor(){return client;}},GetObjectCommand,PutObjectCommand}:n==='@aws-sdk/client-cloudwatch'?{CloudWatchClient:class{async send(){}},PutMetricDataCommand:class{}}:real(n),process:{env:{DRY_RUN:'false'}},console,Date};
 vm.runInNewContext(fs.readFileSync(require.resolve('./index.js'),'utf8'),context);
 return {objects,handler:context.exports.handler,read:context.exports._internal.readStories};
}
test('handler carries persisted degraded input through readStories to fold and world freshness',async()=>{
 const h=harness({updated_at:'2026-10-20T10:00:00Z',degraded:true,status:'failed',stories:[{storyId:'untrusted',centroid:{lat:0,lon:0},axis:'conflict',outlets:4}]});
 assert.equal((await h.read()).newsDegraded,true);assert.equal((await h.read()).stories.length,0);
 const result=await h.handler();assert.equal(result.newsDegraded,true);assert.equal(result.counts.closed,0);assert.equal(result.counts.cooled,0);
 assert.deepEqual(h.objects.get('situations/state/news_conflict_UKR_actor.json'),news);
 assert.equal(h.objects.get('world/latest.json').sources.newsDegraded,true);assert.equal(h.objects.get('world/latest.json').stale,true);
});
test('legacy successful indexes remain readable; missing index is degraded',async()=>{
 const h=harness({updated_at:NOW,stories:[]});assert.equal((await h.read()).newsDegraded,false);
 h.objects.delete('stories/index.json');assert.equal((await h.read()).newsDegraded,true);
});
