#!/usr/bin/env node
// Collect normalized world/ views. Raw-row parsing and common derivations live only in world/.
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {selectInputs,assertSunday,dayPlus} from './selection.mjs';
const world=createRequire(import.meta.url)('../shared/src/world');
export const DEFAULT_COUNTRIES='Iran,Israel,United States,Venezuela,China,Japan,Ukraine,Russia,France,Germany,DR Congo,South Africa'.split(',');
async function pool(items,fn,n=4) {
  let next=0;const out=new Array(items.length);
  await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(next<items.length){const i=next++;out[i]=await fn(items[i]);}}));return out;
}
export async function readInputs(weekEnding,client,opts={}) {
  assertSunday(weekEnding);
  const readQuestions=opts.readQuestions || world.sampledQuestions;
  const readWeb=opts.readWeb || world.webAt;
  if(!readQuestions || !readWeb)throw Error('Weekly requires the coordinator-owned world.sampledQuestions and world.webAt readers');
  const start=dayPlus(weekEnding,-6),from=dayPlus(weekEnding,-36),nextEnd=dayPlus(weekEnding,7);
  const range=await world.archiveRange(client,from,weekEnding,{withAi:true});
  const grouped=world.entriesByThread(range);
  const ids=Object.keys(grouped).filter(id=>grouped[id].some(e=>e.date>=start)).sort();
  const analyses=await world.threadAnalysis(client,ids);
  const rows=await pool(ids,async threadId=>({threadId,
    history:await world.threadHistory(client,threadId,from,weekEnding),
    drift:await world.driftNotes(client,{threadId},start,weekEnding),
    snapshots:await world.scenarios(client,{threadId,topicIds:[...new Set(grouped[threadId].map(e=>e.topicId).filter(Boolean))],to:weekEnding})}));
  const countries=opts.countries || (process.env.DRIFT_COUNTRIES?process.env.DRIFT_COUNTRIES.split(',').map(s=>s.trim()).filter(Boolean):DEFAULT_COUNTRIES);
  const countryRows=await pool(countries,async country=>({country,history:await world.countryHistory(client,country,from,weekEnding),drift:await world.driftNotes(client,{country},start,weekEnding)}));
  const questions=await readQuestions(client,{from:start,to:nextEnd});
  const verdicts=await world.verdicts(client,questions.map(q=>q.qid),{asOf:weekEnding});
  const web=await readWeb(client,weekEnding,{fallback:'latest'});
  const webSource=web?.key || null;
  return {range,analyses,histories:Object.fromEntries(rows.map(r=>[r.threadId,r.history])),driftByThread:Object.fromEntries(rows.map(r=>[r.threadId,r.drift])),
    snapshotsByThread:Object.fromEntries(rows.map(r=>[r.threadId,r.snapshots])),questions,verdicts,web,webSource,
    countryDrift:countryRows.flatMap(r=>r.drift),countryHistory:Object.fromEntries(countryRows.map(r=>[r.country,r.history]))};
}
export async function pull(weekEnding,client,opts={}) {return selectInputs(await readInputs(weekEnding,client,opts),weekEnding);}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {const args=process.argv.slice(2);if(!args.includes('--week-ending'))throw Error('Usage: pull.mjs --week-ending YYYY-MM-DD [--out path]');
    const {makeCliClient}=await import('./local-client.mjs');const result=await pull(args[args.indexOf('--week-ending')+1],makeCliClient());
    const out=args.includes('--out')?args[args.indexOf('--out')+1]:null;
    if(out)await writeFile(out,JSON.stringify(result,null,2)+'\n');else process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }catch(e){console.error(`pull: ${e.message}`);process.exitCode=1;}
}
