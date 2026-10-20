#!/usr/bin/env node
import {pathToFileURL} from 'node:url';
import {assertSunday,dayPlus} from './selection.mjs';
import {liveStore} from './publish.mjs';
export async function hold(weekEnding,store) {
  assertSunday(weekEnding);
  const original=await store.getJson(`weekly/${weekEnding}.json`);
  if(!original)throw Error('Cannot hold a week without a published snapshot');
  // Fixed immutable hold snapshot makes retries safe; never rewrites the published file.
  const held={...original,status:'held'};
  await store.putOnce(`weekly/${weekEnding}.held.json`,held);
  const latest=await store.getJson('weekly/latest.json');
  if(latest && latest.weekEnding!==weekEnding)return {held:weekEnding,latest:latest.weekEnding};
  for(let offset=7;offset<=3640;offset+=7) {
    const priorDay=dayPlus(weekEnding,-offset);
    const prior=await store.getJson(`weekly/${priorDay}.json`);
    if(prior?.status==='published' && !await store.getJson(`weekly/${priorDay}.held.json`)) {
      await store.putLatest('weekly/latest.json',prior);return {held:weekEnding,latest:priorDay};
    }
  }
  // With no predecessor retain a held latest so readers explicitly skip it.
  await store.putLatest('weekly/latest.json',held);return {held:weekEnding,latest:null};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try{console.log(await hold(process.argv[2],await liveStore()));}catch(e){console.error(`hold: ${e.message}`);process.exitCode=1;}
}
