'use strict';

const prompts = require('./prompts');
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
const {
  keepDayZero
} = require('./_shared/dayZero');
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
    const input = await store.load(date);
    const report = {
      date,
      threadsProcessed: 0,
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
      const result = await llm(prompts[task](context));
      if (result.label !== 'JUDGMENT' || !Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) throw Error(`invalid ${task} judgment`);
      if (task === 'chapter' && (typeof result.name !== 'string' || !result.name.trim() || typeof result.text !== 'string' || !result.text.trim())) throw Error('invalid chapter text');
      if (task === 'line' && (typeof result.text !== 'string' || !result.text.trim())) throw Error('invalid line text');
      if (task === 'line' && result.contradicted && (typeof result.reason !== 'string' || !result.reason.trim())) throw Error('line contradiction needs reason');
      if (task === 'trigger' && !['fired', 'hold', 'dead'].includes(result.status)) throw Error('invalid trigger status');
      return result;
    };
    const entries = (input.entries || []).filter(e => e.date <= date).filter(e => e.date !== date || keepDayZero([e], Date.parse(`${date}T12:00:00Z`)).length).map(e => ({
      date: e.date,
      archive: e.archive || `archive#${e.date}`,
      topicId: e.topicId || e.id,
      headline: e.title || '',
      threadId: e.threadId,
      archivedAt: e.archivedAt,
      outlets: e.sources || [],
      actors: e.actors || [],
      countries: e.iso3 || []
    }));
    const ids = [...new Set(entries.filter(e => e.date >= addDays(date, -29)).map(e => e.threadId).filter(Boolean))].sort();
    const stories = [];
    const corrections = [];
    const existingIndex = await s3json.getJson(`${prefix}index.json`);
    if (existingIndex?.date > date) throw Error('refusing to rewind index');
    for (const id of ids) {
      if (!/^[A-Za-z0-9_-]+$/.test(id)) throw Error('unsafe thread id');
      const key = `${prefix}stories/${id}/`;
      const snapshot = await s3json.getJson(`${key}${date}.json`);
      const previous = await s3json.getJson(`${key}latest.json`);
      if (previous?.asOf > date) throw Error(`refusing to rewind ${id}`);
      if (snapshot) {
        stories.push(snapshot);
        continue;
      }
      const own = entries.filter(e => e.threadId === id);
      const today = own.filter(e => e.date === date);
      const analysis = input.analyses?.[id] || {};
      const r = previous ? clone(previous) : {
        threadId: id,
        born: own.map(e => e.date).sort()[0],
        bornAt: own.map(e => e.archivedAt || `${e.date}T00:00:00Z`).sort()[0],
        line: {
          text: '',
          writtenAt: date,
          versions: []
        },
        chapters: [],
        events: [],
        forks: [],
        links: [],
        counts: {}
      };
      if (!previous) report.birthsFound++;
      r.asOf = date;
      r.actors = [...new Set(own.flatMap(e => e.actors).concat(analysis.keyActors || []))].sort();
      r.countries = [...new Set(own.flatMap(e => e.countries).concat(analysis.iso3 || []))].sort();
      r.risk = analysis.riskScore ?? previous?.risk ?? null;
      const drift = input.drifts?.[id];
      // Bootstrap/backfill all available events, not only today's: recovery catches missed runs.
      for (const e of own) if (!r.events.some(p => p.archive === e.archive && p.topicId === e.topicId)) r.events.push({
        ...e,
        killed: [],
        ...(e.date === date && drift ? {
          driftNote: drift
        } : {})
      });
      r.events.sort((a, b) => a.date.localeCompare(b.date) || a.topicId.localeCompare(b.topicId));
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
      for (const p of (input.predictions || []).filter(p => p.threadId === id && day(p.SK) <= date)) {
        const forkId = `${p.PK}/${p.SK}`;
        if (r.forks.some(f => f.forkId === forkId)) continue;
        const branches = [];
        (p.scenarios || []).forEach((s, si) => (s.triggers || []).forEach((t, ti) => branches.push({
          branchId: `${forkId}/${t.id || `${si}-${ti}`}`,
          scenarioId: String(si),
          text: s.label || s.text || t.text,
          p: t.p ?? null,
          trigger: typeof t === 'string' ? t : t.text || '',
          resolutionSource: t.resolutionSource || t.resolution_source || '',
          due: t.deadline || t.due || null,
          ...(t.qid ? {
            qid: t.qid
          } : {}),
          status: []
        })));
        r.forks.push({
          forkId,
          drawnAt: day(p.SK),
          atEvent: p.topicId || p.PK.replace('PRED#', ''),
          branches
        });
      }
      r.forks.sort((a,b)=>a.drawnAt.localeCompare(b.drawnAt) || a.forkId.localeCompare(b.forkId));
      const currentLinks = (input.links || []).filter(l => l.confirmed === true && l.confirmedBy === 'rule' && (l.a === id || l.b === id)).map(l => ({
        otherThreadId: l.a === id ? l.b : l.a,
        strength: l.strength,
        mechanism: l.mechanism || '',
        confirmed: true,
        confirmedBy: 'rule',
        evidence: l.evidence || [],
        since: l.since || date
      }));
      r.links = [...new Map([...r.links, ...currentLinks].map(l => [l.otherThreadId, l])).values()].sort((a,b)=>a.otherThreadId.localeCompare(b.otherThreadId));
      const linked = r.links.map(l => l.otherThreadId);
      const contextEntries = entries.filter(e => e.date === date && (e.threadId === id || linked.includes(e.threadId)));
      for (const fork of r.forks) {
        const decisions = [];
        for (const b of fork.branches) {
          if (!['hold', 'late', 'dead'].includes(lastStatus(b))) continue;
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
          if (prior === 'dead' && row.status === 'hold') continue;
          if (['hold', 'late'].includes(row.status) && b.due && day(b.due) < date) row = {
            ...row,
            status: 'late',
            note: 'Due date passed without an established trigger'
          };
          if (row.status !== prior || !b.status.length) {
            b.status.push({
              date,
              ...row,
              label: 'JUDGMENT',
              confidence: result?.confidence ?? 1
            });
            if (row.status === 'resurrected') corrections.push({
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
      for (const b of r.forks.flatMap(f => f.branches)) if (b.qid) {
        const verdict = (input.verdicts || []).filter(v => v.PK === `Q#${b.qid}` && day(v.decidedAt) <= date).sort((a, b) => verdictOrder(b.SK) - verdictOrder(a.SK))[0];
        if (verdict && verdictOrder(verdict.SK) > verdictOrder(b.scored?.sourceSK)) {
          b.verdicts ||= [];
          b.verdicts.push({
            verdict: verdict.verdict,
            decidedAt: verdict.decidedAt,
            sourceSK: verdict.SK
          });
          b.scored = b.verdicts.at(-1);
          report.verdictsMirrored++;
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
          previousLine: r.line.text
        });
        if (line?.text) {
          if (line.contradicted && r.line.text) {
            const evidence = citations(line.evidence, lineEntries.filter(e => e.date > r.line.writtenAt));
            if (!evidence.length) throw Error('line contradiction needs citations');
            corrections.push({
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
      r.counts = {
        events: r.events.length,
        forks: r.forks.length,
        liveBranches: r.forks.flatMap(f => f.branches).filter(live).length,
        deadBranches: r.forks.flatMap(f => f.branches).filter(b => lastStatus(b) === 'dead').length,
        corrections: (previous?.counts.corrections || 0) + corrections.filter(c => c.threadId === id).length
      };
      r.corrections = [...(previous?.corrections || []), ...corrections.filter(c => c.threadId === id)];
      // Conflict winner is authoritative; never move latest to the loser's object.
      const won = await s3json.putOnce(`${key}${date}.json`, r);
      stories.push(won ? r : await s3json.getJson(`${key}${date}.json`));
    }
    report.proposedMerges = duplicates(stories, date);
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
    const rows = stories.map(r => ({
      id: r.threadId, line: r.line.text, risk: r.risk, born: r.born,
      chapters: r.chapters.length, liveBranches: r.counts.liveBranches,
      lastMoved: r.events.at(-1)?.date || r.born, actors: r.actors,
      countries: r.countries, confirmedLinks: r.links.length
    }));
    const index = {
      date, generated_at: now(), next_expected_at: `${addDays(date, 1)}T05:45:00Z`,
      stale: false, stories: rows, coverage: report.coverage, proposedMerges: report.proposedMerges
    };
    const indexBody = JSON.stringify(index);
    report.indexKB = Buffer.byteLength(indexBody) / 1024;
    report.indexGzipKB = require('node:zlib').gzipSync(indexBody).length / 1024;
    if (report.indexGzipKB > 300) throw Error('record index exceeds 300 KB gzipped');
    const dayCorrections = stories.flatMap(r => (r.corrections || []).filter(c => c.date === date));
    await s3json.putOnce(`${prefix}corrections/${date}.json`, {date, corrections: dayCorrections});
    const correctionIndex = (await s3json.getJson(`${prefix}corrections/index.json`)) || {days: [], corrections: []};
    correctionIndex.corrections ||= [];
    const correctionKey = c => `${c.date}|${c.threadId}|${c.kind}|${c.branchId || ''}`;
    correctionIndex.corrections = [...new Map([...correctionIndex.corrections, ...dayCorrections].map(c => [correctionKey(c), c])).values()].sort((a,b) => b.date.localeCompare(a.date) || correctionKey(a).localeCompare(correctionKey(b)));
    if (dayCorrections.length && !correctionIndex.days.includes(date)) correctionIndex.days.push(date);
    correctionIndex.days.sort().reverse();
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
