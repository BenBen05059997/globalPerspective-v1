'use strict';
// Timeline persistence and projections. All object encoding/conditional writes belong
// to shared s3json; no raw table parsing lives here.
const {makeEvent,cursorOf,eventsThrough,rebuildStory,eventId}=require('./timeline');
const {day,addDays,duplicates}=require('./rules');
const copy=x=>JSON.parse(JSON.stringify(x));
const stamp=(value,fallback)=>value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : fallback;
const runStamp=(date,now)=>day(now)===date?new Date(now).toISOString():`${date}T23:59:59.999Z`;
const entryView=e=>({date:e.date,archive:e.archive,topicId:e.topicId,headline:e.title||'',threadId:e.threadId,
 archivedAt:e.archivedAt,outlets:e.sources||[],actors:e.actors||[],countries:e.iso3||[],sourceKey:e.sourceKey});
function makeTimeline(s3json,prefix,days={}) {
 const manifestKey=`${prefix}timeline/index.json`;
 let manifest;
 return {
  days,
  async load(date){
   manifest=(await s3json.getJson(manifestKey))||{days:[]};
   for(const d of manifest.days.filter(d=>d<=date))days[d]=(await s3json.getLines(`${prefix}timeline/${d}.jsonl`)).lines;
  },
  async append(events){
   if(!events.length)return;
   const grouped={};for(const e of events)(grouped[e.date] ||= []).push(e);
   // Register before append: a failed append leaves an empty discoverable day,
   // never a durable event in a day that readers cannot discover.
   const dates=[...new Set([...manifest.days,...Object.keys(grouped)])].sort();
   if(JSON.stringify(dates)!==JSON.stringify(manifest.days)){manifest={days:dates};await s3json.putLatest(manifestKey,manifest);}
   for(const date of Object.keys(grouped).sort())days[date]=(await s3json.appendLines(`${prefix}timeline/${date}.jsonl`,grouped[date])).stored;
  },
  events(date){return eventsThrough(days,cursorOf(days,date));},
  completion(id,date){return this.events(date).filter(e=>e.kind==='coverage'&&e.threadId===id&&e.payload.processed&&e.payload.date<=date).at(-1);},
  view(id,date){const e=this.completion(id,date);return e?rebuildStory(days,id,{date:e.payload.date,cursor:e.payload.cursor}):null;},
  async complete(id,date,at,llm){
   const prior=this.completion(id,date);if(prior?.payload.date===date)return this.view(id,date);
   const cursor=cursorOf(days,date);cursor[day(at)]=(cursor[day(at)]||0)+1;
   await this.append([makeEvent({kind:'coverage',sourceKey:`record|${id}|${date}|complete`,at,threadId:id,
    sourceRow:{store:'record',key:`${prefix}timeline/index.json`},payload:{processed:true,date,cursor,...(llm?{llm}: {})}})]);
   return this.view(id,date);
  }
 };
}
function rawEvents(input,id,previous,at) {
 const own=input.entries.filter(e=>e.threadId===id);
 const first=own.find(e=>e.date===input.births[id]?.born)||own[0];
 const out=[];
 const add=(kind,row,payload,when,version='')=>{
  if(!row?.sourceRow||!row?.sourceKey)throw Error(`canonical provenance missing for ${kind}: ${id}`);
  out.push(makeEvent({kind,sourceKey:row.sourceKey+version,sourceRow:row.sourceRow,at:stamp(when,at),threadId:id,
   iso3:row.iso3||[],actors:row.actors||(row.keyActors||[]).map(a=>a.name),
   sources:(row.sources||[]).map(s=>({outlet:s.source,url:s.url,archive:row.archive,topicId:row.topicId})),payload}));
 };
 if(!previous&&first){const birth=input.births[id];add('story_born',first,{born:birth.born,bornAt:birth.bornAt,birthEvidence:birth,firstTitle:first.title},birth.bornAt,`|birth|${id}`);}
 for(const e of own)add('entry',e,{entry:entryView(e)},e.archivedAt||`${e.date}T00:00:00Z`);
 for(const h of input.histories[id]||[])add('read_changed',h,{risk:h.score,trajectory:h.trajectory,from:'history'},h.generatedAt||`${h.date}T00:00:00Z`);
 const a=input.analyses[id];
 if(a)add('read_changed',a,{risk:a.riskScore,trajectory:a.trajectory,from:a.source},a.generatedAt||`${a.date}T00:00:00Z`,a.source==='analysis'?`|${a.generatedAt}`:'');
 for(const d of input.drifts[id]||[])add('read_changed',d,{driftNote:d,driftDate:d.date},d.generatedAt||`${d.date}T00:00:00Z`);
 const allForks=[...new Map([...(previous?.forks||[]),...(input.forks[id]||[])].map(f=>[f.forkId,f])).values()];
 for(const f of allForks){
  const row=input.predictions.find(p=>`${p.pk}/${p.date}`===f.forkId);
  const {threadId,...fields}=f;
  const fork={...copy(fields),branches:f.branches.map(b=>{const {qid,...rest}=b;return {...copy(rest),...(qid?{qid}:{}),status:[]};})};
  if(row)add('forecast_drawn',row,{fork},row.generatedAt||`${row.date}T00:00:00Z`);
  for(const b of fork.branches)for(const v of input.verdicts[b.qid]?.all||[])add('verdict',v,{branchId:b.branchId,revision:v.n,qid:b.qid,verdict:v.verdict,decidedAt:v.decidedAt,decidedBy:v.decidedBy,evidence:v.evidence,reason:v.reason,
   scored:{verdict:v.verdict,decidedAt:v.decidedAt,sourceSK:v.sk}},v.decidedAt,`|${b.branchId}`);
 }
 for(const l of input.links.filter(l=>l.confirmed===true&&l.confirmedBy==='rule'&&(l.from===id||l.to===id))){
  add('link_confirmed',l,{link:{otherThreadId:l.from===id?l.to:l.from,strength:l.strength||l.confidence,
   mechanism:l.mechanism||'',confirmed:true,confirmedBy:'rule',evidence:l.evidence||[],since:l.since||day(at)}},l.generatedAt||at,`|${l.generatedAt||l.since||day(at)}|${id}`);
 }
 return out;
}
function judgmentEvents(previous,next,corrections,date,at,existing) {
 const id=next.threadId;const own=existing.filter(e=>e.threadId===id);
 const sourceRow=own.filter(e=>e.kind==='entry').at(-1)?.sourceRow;const out=[];
 const add=(kind,key,payload,provenance=sourceRow)=>out.push(makeEvent({kind,sourceKey:`record|${id}|${key}|${date}`,sourceRow:provenance,at,threadId:id,iso3:next.countries,actors:next.actors,
  sources:(payload.row?.evidence||payload.correction?.evidence||[]).map(ref=>({outlet:next.events.find(e=>e.archive===ref.archive&&e.topicId===ref.topicId)?.outlets.find(o=>o.url===ref.url)?.source||null,...ref})),payload}));
 for(const c of next.chapters)if(!previous.chapters.some(p=>p.startedAt===c.startedAt))add('chapter','chapter',{chapter:c},own.filter(e=>e.kind==='read_changed'&&e.payload.driftNote).at(-1)?.sourceRow||sourceRow);
 for(const b of next.forks.flatMap(f=>f.branches)){
  const before=previous.forks.flatMap(f=>f.branches).find(p=>p.branchId===b.branchId);
  for(const row of b.status.slice(before?.status.length||0))add('branch_status',`status|${b.branchId}`,{branchId:b.branchId,row},own.find(e=>e.kind==='forecast_drawn'&&e.payload.fork.branches.some(p=>p.branchId===b.branchId))?.sourceRow||sourceRow);
 }
 if(next.line.text&&JSON.stringify(next.line)!==JSON.stringify(previous.line)){
  const {versions,...line}=next.line;add('line','line',{line});
 }
 for(const c of corrections){
  const target=existing.filter(e=>e.threadId===id&&(c.kind==='resurrected'?e.kind==='branch_status'&&e.payload.branchId===c.branchId&&e.payload.row.status==='dead':e.kind==='line')).at(-1);
  if(!target)throw Error(`correction has no prior event: ${id}`);
  add('correction',`correction|${c.kind}|${c.branchId||''}`,{correction:c,corrects:target.eventId},target.sourceRow);
 }
 return out;
}
function indexView(days,date) {
 const all=eventsThrough(days,cursorOf(days,date));
 const meta=all.filter(e=>e.kind==='coverage'&&e.threadId===null&&e.payload.date===date).at(-1);
 if(!meta)throw Error('run coverage event missing');
 const p=meta.payload;
 const completed=new Map();for(const e of all)if(e.kind==='coverage'&&e.threadId&&e.payload.processed)completed.set(e.threadId,e);
 const stories=[...completed].map(([id,e])=>rebuildStory(days,id,{date:e.payload.date,cursor:e.payload.cursor}))
  .filter(r=>(r.events.at(-1)?.date||r.born)>=addDays(date,-29)).sort((a,b)=>a.threadId.localeCompare(b.threadId));
 const rows=stories.map(r=>({id:r.threadId,line:r.line.text,risk:r.risk,born:r.born,chapters:r.chapters.length,liveBranches:r.counts.liveBranches,
  lastMoved:r.events.at(-1)?.date||r.born,actors:r.actors,countries:r.countries,confirmedLinks:r.links.length}));
 return {date,generated_at:p.generatedAt,next_expected_at:`${addDays(date,1)}T05:45:00Z`,stale:p.coverage.missingDays.includes(date)||Boolean(p.failures.length),
  stories:rows,coverage:p.coverage,proposedMerges:duplicates(stories,date,p.duplicateAsOf)};
}
module.exports={makeTimeline,rawEvents,judgmentEvents,indexView,entryView,runStamp,eventId};
