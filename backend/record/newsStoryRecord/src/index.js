'use strict';

const prompts = require('./prompts');
const {makeEvent,cursorOf,rebuildStory}=require('./timeline');
const {makeTimeline,rawEvents,judgmentEvents,indexView,entryView,runStamp,eventId}=require('./persistence');
const {
  day,
  addDays,
  lastStatus,
  live,
  verdictOrder,
  duplicates,
  citations,
  transition
} = require('./rules');
const clone = x => JSON.parse(JSON.stringify(x));
function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || day(new Date(`${date}T00:00:00Z`).toISOString()) !== date) throw Error('date must be YYYY-MM-DD');
}
function makeHandler({
  store,
  s3json,
  llm = null,
  now = () => new Date().toISOString()
}) {
  return async function handler({
    date = day(now()),
    shadow = false
  } = {}) {
    validDate(date);
    const prefix = shadow ? 'record/shadow/' : 'record/';
    // load(date) is a read-only, as-of-date store contract; missing archive days are explicit.
    const existingIndex = await s3json.getJson(`${prefix}index.json`);
    if (existingIndex?.date > date) throw Error('refusing to rewind index');
    const timeline=makeTimeline(s3json,prefix);await timeline.load(date);
    const retainedQids=[...new Set(timeline.events(date).filter(e=>e.kind==='forecast_drawn').flatMap(e=>e.payload.fork.branches.map(b=>b.qid)).filter(Boolean))];
    const input = await store.load(date,{since:existingIndex?.date ? existingIndex.date : undefined,qids:retainedQids});
    const report = {
      date,
      threadsProcessed: 0,
      threadsAttempted: 0,
      birthsFound: 0,
      proposedMerges: [],
      forks: 0,
      branches: 0,
      lateBranches: 0,
      verdictsMirrored: 0,
      llmCalls: {
        chapter: 0,
        trigger: 0,
        line: 0
      },
      skipped: [],
      failures: [],
      coverage: input.coverage || {
        missingDays: []
      }
    };
    const ask = async (task, context) => {
      report.llmCalls[task]++;
      if (!llm) {
        report.skipped.push({
          task,
          threadId: context.threadId,
          reason: 'not run: no llm'
        });
        return null;
      }
      try {
      const result = await llm(prompts[task](context));
      if (result.label !== 'JUDGMENT' || !Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) throw Error(`invalid ${task} judgment`);
      if (task === 'chapter' && (typeof result.name !== 'string' || !result.name.trim() || typeof result.text !== 'string' || !result.text.trim())) throw Error('invalid chapter text');
      if (task === 'line' && (typeof result.text !== 'string' || !result.text.trim())) throw Error('invalid line text');
      if (task === 'line' && result.contradicted && (typeof result.reason !== 'string' || !result.reason.trim())) throw Error('line contradiction needs reason');
      if (task === 'trigger' && !['fired', 'hold', 'dead'].includes(result.status)) throw Error('invalid trigger status');
      return result;
      } catch(error) {error.recordJudgment=true;error.recordTask=task;throw error;}
    };
    const at=runStamp(date,now());
    const entries=input.entries.filter(e=>e.date<=date).map(entryView);
    const ids = [...new Set(entries.filter(e => e.date >= addDays(date, -29)).map(e => e.threadId).filter(Boolean))].sort();
    report.threadsAttempted=ids.length;
    const stories = [];
    for (const id of ids) {
      if (!/^[A-Za-z0-9_-]+$/.test(id)) throw Error('unsafe thread id');
      const key = `${prefix}stories/${id}/`;
      const completion=timeline.completion(id,date);
      const snapshot=await s3json.getJson(`${key}${date}.json`);
      if (completion?.payload.date===date) {
        const view=timeline.view(id,date);
        if(snapshot && JSON.stringify(snapshot)!==JSON.stringify(view))throw Error(`snapshot disagrees with timeline: ${id}`);
        if(!snapshot)await s3json.putOnce(`${key}${date}.json`,view);
        stories.push(view);continue;
      }
      const before=rebuildStory(timeline.days,id,{date});
      const facts=rawEvents(input,id,before,at);
      const known=new Set(timeline.events(date).map(e=>e.eventId));
      await timeline.append(facts);
      report.verdictsMirrored+=facts.filter(e=>e.kind==='verdict'&&!known.has(e.eventId)).length;
      const previous=rebuildStory(timeline.days,id,{date});
      if(!before)report.birthsFound++;
      const storyCorrections=[];
      const checks=[];
      const checkedBranches=new Set(timeline.events(date).filter(e=>e.threadId===id&&e.kind==='branch_status'&&e.payload.row.date===date).map(e=>e.payload.branchId));
      try {
      const own = entries.filter(e => e.threadId === id);
      const today = own.filter(e => e.date === date);
      const analysis = input.analyses?.[id] || {};
      const r = clone(previous);
      r.asOf = date;
      const driftNotes = input.drifts?.[id] || [];
      const drift = driftNotes.at(-1);
      if (drift && (!r.chapters.length || r.chapters.at(-1).writtenAt < addDays(date, -7))) {
        const c = await ask('chapter', {
          threadId: id,
          drift,
          entries: today
        });
        if (c?.name && c?.text) r.chapters.push({
          startedAt: date,
          name: c.name,
          text: c.text,
          writtenAt: date,
          label: c.label,
          confidence: c.confidence
        });
      }
      const linked = r.links.map(l => l.otherThreadId);
      const contextEntries = entries.filter(e => e.date === date && (e.threadId === id || linked.includes(e.threadId)));
      for (const fork of r.forks) {
        const decisions = [];
        for (const b of fork.branches) {
          if (checkedBranches.has(b.branchId)||!['hold', 'late', 'dead'].includes(lastStatus(b))) continue;
          let result = null;
          if (contextEntries.length) result = await ask('trigger', {
            threadId: id,
            trigger: b.trigger,
            due: b.due,
            resolutionSource: b.resolutionSource,
            entries: contextEntries,
            siblings: fork.branches.filter(s => s !== b).map(s => ({
              trigger: s.trigger,
              status: lastStatus(s)
            }))
          });
          decisions.push({
            b,
            result
          });
        }
        // First establish fires; then sibling deaths, independent of branch iteration order.
        const fired = decisions.filter(({
          b,
          result
        }) => result && ['fired', 'resurrected'].includes(transition(b, result, contextEntries, false).status)).map(d => d.b);
        for (const {
          b,
          result
        } of decisions) {
          const prior = lastStatus(b);
          let row = result ? transition(b, result, contextEntries, fork.branches.some(s => s !== b && s.scenarioId !== b.scenarioId && (['fired', 'resurrected'].includes(lastStatus(s)) || fired.includes(s)))) : {
            status: prior === 'dead' ? 'dead' : 'hold',
            evidence: [],
            note: contextEntries.length ? 'not run: no llm' : 'No new entries'
          };
          if (prior === 'dead' && row.status === 'hold') {
            if(result)checks.push({branchId:b.branchId,changed:false,row:{date,...row,label:'JUDGMENT',confidence:result.confidence}});
            continue;
          }
          if (['hold', 'late'].includes(row.status) && b.due && day(b.due) < date) row = {
            ...row,
            status: 'late',
            note: 'Due date passed without an established trigger'
          };
          if(result)checks.push({branchId:b.branchId,changed:row.status!==prior||!b.status.length,row:{date,...row,label:'JUDGMENT',confidence:result.confidence}});
          if (row.status !== prior || !b.status.length) {
            b.status.push({
              date,
              ...row,
              label: 'JUDGMENT',
              confidence: result?.confidence ?? 1
            });
            if (row.status === 'resurrected') storyCorrections.push({
              threadId: id,
              branchId: b.branchId,
              date,
              priorDate: b.status.at(-2)?.date,
              kind: 'resurrected',
              reason: row.note,
              evidence: row.evidence
            });
            if (row.status === 'dead') for (const e of r.events.filter(e => e.date === date)) if (!e.killed.includes(b.branchId)) e.killed.push(b.branchId);
          }
        }
      }
      // Weekly rewrite; a dated line is never rewritten on retry. Changes outside this cadence wait.
      if (!r.line.text || r.line.writtenAt <= addDays(date, -7)) {
        const lineEntries = r.events.slice(-10);
        const line = await ask('line', {
          threadId: id,
          chapter: r.chapters.at(-1) || null,
          statuses: r.forks.flatMap(f => f.branches.map(b => ({
            trigger: b.trigger,
            status: b.status.at(-1) || null
          }))),
          entries: lineEntries,
          previousLine: r.line.text,
          previousWrittenAt: r.line.writtenAt
        });
        if (line?.text) {
          delete r.llm;
          if (line.contradicted && r.line.text) {
            const evidence = citations(line.evidence, lineEntries.filter(e => e.date > r.line.writtenAt));
            if (!evidence.length) {const error=Error('line contradiction needs citations');error.recordJudgment=true;error.recordTask='line';throw error;}
            storyCorrections.push({
              threadId: id,
              date,
              priorDate: r.line.writtenAt,
              kind: 'line-contradicted',
              reason: line.reason,
              evidence
            });
          }
          const versions = r.line.text ? [...r.line.versions, {
            text: r.line.text,
            writtenAt: r.line.writtenAt,
            label: r.line.label,
            confidence: r.line.confidence
          }] : r.line.versions;
          r.line = {
            text: line.text,
            writtenAt: date,
            versions,
            label: line.label,
            confidence: line.confidence
          };
        } else r.llm = {
          status: 'not run: no llm'
        };
      }
      await timeline.append(judgmentEvents(previous,r,storyCorrections,date,at,timeline.events(date),checks));
      const view=await timeline.complete(id,date,at,r.llm);
      // A conflict is accepted only when the winner is the same timeline view.
      const won=await s3json.putOnce(`${key}${date}.json`,view);
      const winner=won?view:await s3json.getJson(`${key}${date}.json`);
      if(JSON.stringify(winner)!==JSON.stringify(view))throw Error(`snapshot disagrees with timeline: ${id}`);
      stories.push(winner);
      } catch(error) {
        // Storage/projection failures must abort rather than publish a corrupt view.
        if(!error.recordJudgment)throw error;
        report.failures.push({threadId:id,task:error.recordTask,error:error.message});
        console.error('[record-story-failed] '+JSON.stringify(report.failures.at(-1)));
        const retained=timeline.view(id,date);if(retained)stories.push(retained);
      }
    }
    report.proposedMerges = duplicates(stories, date, now());
    const branches = stories.flatMap(r => r.forks.flatMap(f => f.branches));
    report.threadsProcessed = stories.length;
    report.birthsOnDate = stories.filter(r => r.born === date).length;
    report.forks = stories.reduce((n, r) => n + r.forks.length, 0);
    report.branches = branches.length;
    report.lateBranches = branches.filter(b => lastStatus(b) === 'late').length;
    report.coverage.branchFields = {
      missingProbability: branches.filter(b => b.p == null).length,
      missingSource: branches.filter(b => !b.resolutionSource).length,
      missingDue: branches.filter(b => !b.due).length
    };
    const completed=timeline.events(date).filter(e=>e.kind==='coverage'&&e.threadId&&e.payload.date===date&&e.payload.processed).map(e=>e.eventId).sort();
    const coverageKey=`run|${date}|${eventId('coverage',JSON.stringify({completed,failures:report.failures}))}`;
    await timeline.append([makeEvent({kind:'coverage',sourceKey:coverageKey,at,sourceRow:{store:'record',key:`${prefix}timeline/index.json`},
      payload:{date,generatedAt:at,duplicateAsOf:at,coverage:report.coverage,failures:report.failures,processingCursor:cursorOf(timeline.days,date)}})]);
    const index=indexView(timeline.days,date);
    report.proposedMerges=index.proposedMerges;
    const indexBody = JSON.stringify(index);
    report.indexKB = Buffer.byteLength(indexBody) / 1024;
    report.indexGzipKB = require('node:zlib').gzipSync(indexBody).length / 1024;
    if (report.indexGzipKB > 300) throw Error('record index exceeds 300 KB gzipped');
    const allCorrections=timeline.events(date).filter(e=>e.kind==='correction').map(e=>({...e.payload.correction,eventId:e.eventId,corrects:e.payload.corrects}));
    const dayCorrections=allCorrections.filter(c=>c.date===date);
    const correctionView={date,corrections:dayCorrections};
    const correctionsWon=await s3json.putOnce(`${prefix}corrections/${date}.json`,correctionView);
    if(!correctionsWon && JSON.stringify(await s3json.getJson(`${prefix}corrections/${date}.json`))!==JSON.stringify(correctionView)) {
      // A retry may recover a failed story after other stories published. The
      // first daily view stays immutable; the latest feed carries the later event.
      report.correctionsSnapshotLag=true;
    }
    const correctionIndex={days:[...new Set(allCorrections.map(c=>c.date))].sort().reverse(),corrections:allCorrections.sort((a,b)=>b.date.localeCompare(a.date)||a.eventId.localeCompare(b.eventId))};
    // No pointers change until computation, validation, reads and immutable writes succeed.
    for (const r of stories) await s3json.putLatest(`${prefix}stories/${r.threadId}/latest.json`, r);
    await s3json.putLatest(`${prefix}corrections/index.json`, correctionIndex);
    await s3json.putLatest(`${prefix}index.json`, index);
    report.llmCalls.total = Object.values(report.llmCalls).reduce((a, b) => a + b, 0);
    return report;
  };
}
module.exports = {
  makeHandler,
  validDate
};
