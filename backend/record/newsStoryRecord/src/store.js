'use strict';

// This facade selects record inputs from the canonical world reader. It never
// parses raw rows, derives a birth/fork, or scans a table.
const world = require('./_shared/world');

async function inBatches(items, fn) {
  const out=[];
  for (let i=0;i<items.length;i+=4) out.push(...await Promise.all(items.slice(i,i+4).map(fn)));
  return out;
}

function makeStore(client,{env={},tables,now=()=>new Date().toISOString(),readWeb=()=>world.webLatest(client)}={}) {
  return {async load(date,{since}={}) {
    const from=world.addDays(date,-29);
    const opts={env,tables};
    const range=await world.archiveRange(client,from,date,{...opts,nowMs:Date.parse(now())});
    const entries=range.days.flatMap(d=>d.entries);
    const byThread=world.entriesByThread(range);
    const births=world.birthByThread(range);
    const ids=Object.keys(byThread).sort();
    const [currentAnalyses,web]=await Promise.all([world.threadAnalysis(client,ids,opts),readWeb(date)]);
    const analyses={},drifts={},forks={},histories={},snapshots=[];
    await inBatches(ids,async id=>{
      const [history,notes,predictions]=await Promise.all([
        world.threadHistory(client,id,from,date,opts),
        world.driftNotes(client,{threadId:id},since || from,date,opts),
        world.scenarios(client,{threadId:id,topicIds:byThread[id].map(e=>e.topicId).filter(Boolean),to:date},opts)
      ]);
      const reading=world.analysisAsOf(currentAnalyses[id],history,date);
      const source=reading?.source==='analysis'?currentAnalyses[id]:history.find(h=>h.date===reading?.date);
      analyses[id]=reading?{...source,...reading,
        keyActors:reading.source==='analysis'?currentAnalyses[id].keyActors:[],
        iso3:reading.source==='analysis'?currentAnalyses[id].iso3:[]}:null;
      histories[id]=history;drifts[id]=notes;
      forks[id]=world.branchesFromScenarios(predictions);
      snapshots.push(...predictions);
    });
    const qids=Object.values(forks).flatMap(fs=>fs.flatMap(f=>f.branches.map(b=>b.qid))).filter(Boolean);
    const verdicts=await world.verdicts(client,qids,{...opts,asOf:date});
    const coverage=world.coverage(range,{since:from,births,analyses});
    const analysisDates=Object.values(analyses).filter(Boolean).map(a=>a.date).filter(Boolean).sort();
    coverage.sources={archives:{asOf:range.days.at(-1)?.date || null},threadAnalyses:{asOf:analysisDates.at(-1)||null,oldest:analysisDates[0]||null},
      predictions:{asOf:snapshots.map(s=>s.date).sort().at(-1)||null},web:{asOf:web?.generatedAt||null}};
    coverage.missingAnalyses=ids.filter(id=>!analyses[id]).map(threadId=>({threadId,reason:'no as-of analysis'}));
    coverage.historyFallback=ids.filter(id=>analyses[id]?.source==='history');
    coverage.birthWindow={from,to:date,limited:ids.filter(id=>births[id].windowLimited),rule:'canonical world.birthByThread; persisted births are retained'};
    return {date,entries,range,births,analyses,currentAnalyses,histories,drifts,forks,
      predictions:snapshots.sort((a,b)=>a.date.localeCompare(b.date)||a.pk.localeCompare(b.pk)),
      verdicts,links:web?.index?.links || [],web,coverage};
  }};
}
module.exports={makeStore,inBatches};
