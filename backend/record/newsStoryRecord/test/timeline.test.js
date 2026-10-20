'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {createHash}=require('node:crypto');
const {eventId,makeEvent,cursorOf,rebuildStory}=require('../src/timeline');
const date='2026-10-19';
function event(kind,key,payload,at=`${date}T05:45:00Z`) {return makeEvent({kind,sourceKey:key,at,threadId:'a',iso3:['CAN'],actors:['An Actor'],sources:[],payload,sourceRow:{store:'fixture',key}});}
function fixture(){return {[date]:[
 event('story_born','birth:a',{born:date,bornAt:`${date}T04:00:00Z`,firstTitle:'First headline'},`${date}T04:00:00Z`),
 event('entry','entry:a',{entry:{date,archive:`archive#${date}`,topicId:'topic-a',headline:'Headline',outlets:[],actors:['An Actor'],countries:['CAN'],threadId:'a'}},`${date}T04:00:00Z`),
 event('read_changed','analysis:a',{risk:50}),
 event('chapter','chapter:a',{chapter:{startedAt:date,writtenAt:date,name:'Chapter',text:'A sentence.',label:'JUDGMENT',confidence:0.8}}),
 event('forecast_drawn','fork:a',{fork:{forkId:'fork-a',drawnAt:date,atEvent:'topic-a',branches:[{branchId:'branch-a',scenarioId:'0',text:'Outcome',p:65,trigger:'Event occurs',due:'2026-10-18',resolutionSource:'Reuters',status:[]}]}}),
 event('branch_status','status:a',{branchId:'branch-a',changed:true,row:{date,status:'dead',evidence:[],note:'Impossible',label:'JUDGMENT',confidence:0.8}}),
 event('line','line:a',{line:{text:'Current line.',writtenAt:date,label:'JUDGMENT',confidence:0.8}})
]};}
test('event identity uses SHA1(kind + sourceKey), with canonical provenance and labels',()=>{
 const e=event('entry','entry:a',{entry:{}});assert.equal(e.eventId,createHash('sha1').update('entryentry:a').digest('hex'));assert.equal(e.label,'fact');assert.equal(e.sourceRow.key,'entry:a');
 assert.throws(()=>makeEvent({kind:'entry',sourceKey:'x',at:new Date().toISOString(),actors:[{}],payload:{},sourceRow:{store:'fixture',key:'x'}}),/canonical actor/);
});
test('rebuilding a story from the stored timeline produces the same complete view',()=>{
 const days=fixture();const original=JSON.parse(JSON.stringify(days));const record=rebuildStory(days,'a',{date});
 assert.equal(record.line.text,'Current line.');assert.equal(record.counts.deadBranches,1);assert.deepEqual(record.events[0].killed,['branch-a']);
 assert.deepEqual(rebuildStory(JSON.parse(JSON.stringify(days)),'a',{date,cursor:record.timelineCursor}),record);assert.deepEqual(days,original);
});
test('saved cursor preserves a dated view after late historical arrivals',()=>{
 const days=fixture();const record=rebuildStory(days,'a',{date});
 days[date].push(event('entry','late-entry',{entry:{date,archive:`archive#${date}`,topicId:'late',headline:'Late arrival',outlets:[],actors:[],countries:['CAN']}}));
 assert.deepEqual(rebuildStory(days,'a',{date,cursor:record.timelineCursor}),record);
 assert.equal(rebuildStory(days,'a',{date}).counts.events,2);
});
test('event duplicates and chapter retries never rewrite the original text',()=>{
 const days=fixture();days[date].push(event('chapter','chapter:a',{chapter:{startedAt:date,writtenAt:date,name:'Changed',text:'Wrong rewrite.'}}));
 days[date].push(event('chapter','other-key',{chapter:{startedAt:date,writtenAt:date,name:'Changed',text:'Also wrong.'}}));
 const r=rebuildStory(days,'a',{date});assert.equal(r.chapters.length,1);assert.equal(r.chapters[0].text,'A sentence.');assert.equal(cursorOf(days,date)[date],9);
});
