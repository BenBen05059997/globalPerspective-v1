#!/usr/bin/env node
// Read-only validation of local dry-run objects using the runtime's own codecs/projections.
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {makeS3Json}=require('./src/_shared/s3json');
const {makeTimeline,indexView}=require('./src/persistence');
const {rebuildStory}=require('./src/timeline');
const args=process.argv.slice(2),out=resolve(args[args.indexOf('--out')+1]);
if(!args.includes('--out'))throw Error('usage: validate-local.mjs --out <dry-run-directory>');
const frontend=createRequire(resolve(process.env.FRONTEND_NODE_MODULES||'global-perspectives-starter/frontend/node_modules','ajv/package.json'));
const Ajv=frontend('ajv');const validate=new Ajv({allErrors:true,strict:false}).compile(JSON.parse(readFileSync(new URL('./schema/story-record.schema.json',import.meta.url),'utf8')));
class Get{constructor(input){this.input=input;}}
const s3=makeS3Json({bucket:'local',GetObjectCommand:Get,PutObjectCommand:class{},client:{async send(command){
 if(!(command instanceof Get))throw Error('validator refuses writes');
 const path=resolve(out,command.input.Key);if(!path.startsWith(out+'/'))throw Error('unsafe key');
 if(!existsSync(path))throw Object.assign(Error('missing'),{name:'NoSuchKey'});
 const body=readFileSync(path,'utf8');return {ETag:createHash('sha256').update(body).digest('hex'),Body:{transformToString:async()=>body}};
}}});
const prefix='record/shadow/';const index=await s3.getJson(prefix+'index.json');
const timeline=makeTimeline(s3,prefix);await timeline.load(index.date);
let stories=0,dated=0,latest=0;
for(const id of readdirSync(resolve(out,prefix,'stories'))){
 for(const file of readdirSync(resolve(out,prefix,'stories',id))){
  const record=await s3.getJson(`${prefix}stories/${id}/${file}`);
  assert.equal(validate(record),true,`${id}/${file}: ${JSON.stringify(validate.errors)}`);
  assert.deepEqual(rebuildStory(timeline.days,id,{date:record.asOf,cursor:record.timelineCursor}),record,`${id}/${file}: rebuild mismatch`);
  stories++;if(file==='latest.json')latest++;else dated++;
 }
}
assert.equal(validate(index),true,JSON.stringify(validate.errors));assert.deepEqual(indexView(timeline.days,index.date),index);
const ids=new Set();let events=0;
for(const [date,rows] of Object.entries(timeline.days))for(const e of rows){
 assert.equal(e.date,date);assert.equal(ids.has(e.eventId),false,`duplicate ${e.eventId}`);ids.add(e.eventId);
 assert.ok(e.sourceRow.store&&e.sourceRow.key);assert.ok(['fact','judgment'].includes(e.label));events++;
}
for(const file of readdirSync(out).filter(f=>/^index-\d{4}-\d{2}-\d{2}\.json$/.test(f))){
 const saved=JSON.parse(readFileSync(resolve(out,file),'utf8'));assert.equal(validate(saved),true,JSON.stringify(validate.errors));
 assert.deepEqual(indexView(timeline.days,saved.date),saved,`${file}: index rebuild mismatch`);
}
const correctionIndex=await s3.getJson(prefix+'corrections/index.json');
const corrections=timeline.events(index.date).filter(e=>e.kind==='correction').map(e=>({...e.payload.correction,eventId:e.eventId,corrects:e.payload.corrects}));
assert.deepEqual(correctionIndex.corrections,corrections.sort((a,b)=>b.date.localeCompare(a.date)||a.eventId.localeCompare(b.eventId)));
for(const file of readdirSync(resolve(out,prefix,'corrections')).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f))){
 const saved=await s3.getJson(prefix+'corrections/'+file);assert.deepEqual(saved.corrections,corrections.filter(c=>c.date===saved.date));
}
console.log(JSON.stringify({valid:true,storyObjects:stories,datedStories:dated,latestStories:latest,indexes:readdirSync(out).filter(f=>/^index-\d{4}-\d{2}-\d{2}\.json$/.test(f)).length+1,timelineDays:Object.keys(timeline.days).length,timelineEvents:events,corrections:corrections.length},null,2));
