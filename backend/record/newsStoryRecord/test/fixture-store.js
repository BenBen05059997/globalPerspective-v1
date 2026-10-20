'use strict';
// A fake database, not a competing parser. Raw fixture rows are fed through the
// same canonical world readers used by the runtime.
const {makeStore}=require('../src/store');
function fixtureStore(input) {
 return {async load(date,options={}) {
  const archive=new Map();
  for(const e of input.entries || []) {const list=archive.get(e.date)||[];list.push(e);archive.set(e.date,list);}
  const rows=[];
  for(const [id,a] of Object.entries(input.analyses || {})) rows.push({...a,PK:`THREAD#${id}`,SK:'THREAD_ANALYSIS',generatedAt:a.generatedAt || '2026-10-19T04:40:00Z'});
  for(const [id,notes] of Object.entries(input.drifts || {}))for(const note of Array.isArray(notes)?notes:[notes])rows.push({...note,PK:`THREAD#${id}`,SK:`DRIFTLOG#${note.date || '2026-10-19'}`,generatedAt:note.generatedAt || '2026-10-19T05:30:00Z'});
  rows.push(...(input.summaryRows || []));
  const predictions=[...(input.predictions || []),...(input.verdicts || [])];
  const client={
   async getItem(table,key) {
    if(key.id==='today-archive')return {entries:input.entries || []};
    if(key.id){const d=key.id.slice('archive#'.length);if(input.coverage?.missingDays?.includes(d))return null;return archive.has(d)?{id:key.id,entries:archive.get(d)}:null;}
    return rows.find(r=>r.PK===key.PK && r.SK===key.SK)||null;
   },
   async batchGet(table,keys){return (await Promise.all(keys.map(k=>client.getItem(table,k)))).filter(Boolean);},
   async query(table,pk,prefix){return [...rows,...predictions].filter(r=>r.PK===pk && (!prefix || r.SK.startsWith(prefix)));},
   async getS3Json(){return input.web || (input.links?{generatedAt:`${date}T05:00:00Z`,index:{links:input.links}}:null);}
  };
  return makeStore(client,{now:()=>`${date}T12:00:00Z`}).load(date,options);
 }};
}
module.exports={fixtureStore};
