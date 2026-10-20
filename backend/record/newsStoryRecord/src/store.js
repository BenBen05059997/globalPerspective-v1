'use strict';
const {day,addDays}=require('./rules');
const {keepDayZero}=require('./_shared/dayZero');
// io only exposes get(table,key), scan(table,filter,values), query(table,pk), web(date).
// Both adapters paginate with Limit=100, and propagate read errors (never treat failure as absence).
function makeStore(io,{cache='NewsCache',summary='SummarizeAndPredict',predictions='GlobalPerspectivePredictionLog'}={}) {
 return {async load(date) {
  const archives=await io.scan(cache,'begins_with(id, :a) AND id <= :end',{':a':'archive#',':end':`archive#${date}`});
  const archiveDays=new Set(archives.map(r=>r.id.slice(8)));
  const today=await io.get(cache,{id:'today-archive'});
  const entries=archives.flatMap(r=>(r.entries || []).map(e=>({...e,date:r.id.slice(8)})));
  for(const e of keepDayZero(today?.entries,Date.parse(`${date}T12:00:00Z`))) if(!entries.some(p=>p.date===date && p.topicId===e.topicId))entries.push({...e,date});
  const ids=[...new Set(entries.filter(e=>e.date>=addDays(date,-29) && e.threadId).map(e=>e.threadId))].sort();
  const analyses={},drifts={},missingAnalyses=[];
  for(const id of ids) {
   const rows=await io.query(summary,`THREAD#${id}`);
   const history=rows.filter(r=>r.SK.startsWith('THREAD_HISTORY#') && r.SK.slice(15)<=date).sort((a,b)=>b.SK.localeCompare(a.SK));
   const current=rows.find(r=>r.SK==='THREAD_ANALYSIS' && day(r.generatedAt)<=date);
   // Do not leak a current analysis backward into a historical replay.
   const hist=history[0];analyses[id]=current || hist || {};
   if(!current)missingAnalyses.push({threadId:id,reason:hist?'using historical scalar analysis; actor metadata from archives':'no as-of analysis'});
   drifts[id]=rows.find(r=>r.SK===`DRIFT#${date}`) || rows.find(r=>r.SK===`DRIFTLOG#${date}`);
  }
  const pred=await io.scan(predictions,'begins_with(PK, :p) OR begins_with(PK, :q)',{':p':'PRED#',':q':'Q#'});
  const web=await io.web(date);const bundle=web?.index || web;
  const links=(bundle?.links || []).map(l=>({...l,a:l.a || l.from,b:l.b || l.to,strength:l.strength || l.confidence}));
  const missingDays=[];for(let d=addDays(date,-29);d<=date;d=addDays(d,1))if(!archiveDays.has(d))missingDays.push(d);
  return {entries,analyses,drifts,predictions:pred.filter(r=>r.PK.startsWith('PRED#') && day(r.SK)<=date),verdicts:pred.filter(r=>r.PK.startsWith('Q#') && /^VERDICT(?:#\d+)?$/.test(r.SK)),links,coverage:{missingDays,missingAnalyses,archiveEarliest:[...archiveDays].sort()[0] || null,birthScope:'earliest retained archive; deleted archive history cannot be reconstructed',web:bundle?'available':'no as-of web snapshot',confirmedLinks:links.filter(l=>l.confirmed===true && l.confirmedBy==='rule').length}};
 }};
}
module.exports={makeStore};
