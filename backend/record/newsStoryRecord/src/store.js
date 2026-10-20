'use strict';

const {
  day,
  addDays
} = require('./rules');
const {
  keepDayZero
} = require('./_shared/dayZero');
// io only exposes get(table,key), scan(table,filter,values), query(table,pk), web(date).
// Both adapters paginate with Limit=100, and propagate read errors (never treat failure as absence).
function makeStore(io, {
  cache = 'NewsCache',
  summary = 'SummarizeAndPredict',
  predictions = 'GlobalPerspectivePredictionLog'
} = {}) {
  return {
    async load(date) {
      const [archives, pred, today, web] = await Promise.all([
        io.scan(cache, 'begins_with(id, :a) AND id <= :end', {':a':'archive#', ':end':`archive#${date}`}),
        io.scan(predictions, 'begins_with(PK, :p) OR begins_with(PK, :q)', {':p':'PRED#', ':q':'Q#'}),
        io.get(cache, {id:'today-archive'}),
        io.web(date)
      ]);
      const archiveDays = new Set(archives.map(r => r.id.slice(8)));
      const entries = archives.flatMap(r => (r.entries || []).map(e => ({
        ...e,
        date: r.id.slice(8)
      })));
      for (const e of keepDayZero(today?.entries, Date.parse(`${date}T12:00:00Z`))) if (!entries.some(p => p.date === date && p.topicId === e.topicId)) entries.push({
        ...e,
        date
      });
      const ids = [...new Set(entries.filter(e => e.date >= addDays(date, -29) && e.threadId).map(e => e.threadId))].sort();
      const analyses = {},
        drifts = {},
        missingAnalyses = [];
      for (let start = 0; start < ids.length; start += 4) {
       await Promise.all(ids.slice(start,start+4).map(async id => {
        const rows = await io.query(summary, `THREAD#${id}`);
        const history = rows.filter(r => r.SK.startsWith('THREAD_HISTORY#') && r.SK.slice(15) <= date).sort((a, b) => b.SK.localeCompare(a.SK));
        const current = rows.find(r => r.SK === 'THREAD_ANALYSIS' && day(r.generatedAt) <= date);
        // Do not leak a current analysis backward into a historical replay.
        const hist = history[0];
        analyses[id] = current || hist || {};
        if (!current) missingAnalyses.push({
          threadId: id,
          reason: hist ? 'using historical scalar analysis; actor metadata from archives' : 'no as-of analysis'
        });
        drifts[id] = rows.find(r => r.SK === `DRIFT#${date}`) || rows.find(r => r.SK === `DRIFTLOG#${date}`);
       }));
      }
      missingAnalyses.sort((a,b)=>a.threadId.localeCompare(b.threadId));
      const bundle = web?.index || web;
      const links = (bundle?.links || []).map(l => ({
        ...l,
        a: l.a || l.from,
        b: l.b || l.to,
        strength: l.strength || l.confidence
      }));
      const missingDays = [];
      for (let d = addDays(date, -29); d <= date; d = addDays(d, 1)) if (!archiveDays.has(d)) missingDays.push(d);
      const analysisDates = Object.values(analyses).map(a=>day(a.generatedAt || a.dateKey || String(a.SK || '').replace('THREAD_HISTORY#',''))).filter(Boolean).sort();
      return {
        entries,
        analyses,
        drifts,
        predictions: pred.filter(r => r.PK.startsWith('PRED#') && day(r.SK) <= date),
        verdicts: pred.filter(r => r.PK.startsWith('Q#') && /^VERDICT(?:#\d+)?$/.test(r.SK)),
        links,
        coverage: {
          missingDays,
          sources: {
            archives: {asOf: [...archiveDays].sort().at(-1) || null},
            threadAnalyses: {asOf: analysisDates.at(-1) || null, oldest: analysisDates[0] || null},
            predictions: {asOf: pred.filter(r=>r.PK.startsWith('PRED#') && day(r.SK)<=date).map(r=>day(r.SK)).sort().at(-1) || null},
            web: {asOf: bundle?.generatedAt || null}
          },
          missingAnalyses,
          archiveEarliest: [...archiveDays].sort()[0] || null,
          birthScope: 'earliest retained archive; deleted archive history cannot be reconstructed',
          web: bundle ? 'available' : 'no as-of web snapshot',
          confirmedLinks: links.filter(l => l.confirmed === true && l.confirmedBy === 'rule').length
        }
      };
    }
  };
}
module.exports = {
  makeStore
};
