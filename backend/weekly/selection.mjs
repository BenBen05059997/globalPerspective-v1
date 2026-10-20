// Pure selection. No clock, network, model calls, or coverage-volume ranking.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { tierFromScore } = require('../shared/src/riskDimensions.js');
const { SECTIONS } = require('./sections.js');
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const hashInputs = ({ inputsHash, ...body }) => createHash('sha256').update(canonical(body)).digest('hex');
export function dayPlus(day, n) { return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10); }
export function assertSunday(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '') || dayPlus(day, 0) !== day || new Date(`${day}T00:00:00Z`).getUTCDay() !== 0) throw Error('week-ending must be a valid Sunday YYYY-MM-DD');
}
const sorted = xs => [...xs].sort((a,b) => canonical(a).localeCompare(canonical(b)));
const dateOf = r => String(r.asOf || r.dateKey || r.date || r.generatedAt || r.SK?.split('#').slice(1).join('#') || '').slice(0,10);
export function eventEvidence(entry) {
  // Conservative lexical gate: a dated archive entry must name a completed action.
  // Unknown/non-events are kept in excluded with a reason, never guessed into new.
  const text = String(entry.title || '');
  const periodic = /\b(report|survey|outlook|forecast|weekly|monthly|annual|warns?|urges?|calls? for|says?|tells?)\b/i;
  const action = /\b(attack\w*|struck|strike\w*|hit|kills?|killed|die[sd]?|dead|collapse\w*|arrest\w*|elect\w*|resign\w*|launch\w*|fire[sd]?|caught fire|bomb\w*|signs?|signed|approv\w*|suspend\w*|halt\w*|shut\w*|seiz\w*|board\w*|clash\w*|endorse\w*|overtur\w*|flood\w*|landfall|begins?|began|impos\w*|releas\w*|detain\w*)\b/i;
  return !/\b(report|survey|outlook|forecast|weekly|monthly|annual)\b/i.test(text) && action.test(text) && (!periodic.test(text) || /\b(attack\w*|struck|killed|collapse\w*|arrest\w*|caught fire|shut\w*|clash\w*)\b/i.test(text));
}
// Path changes need an explicit directional signal in the logged explanation and
// different trajectory text; a mere rewrite or probability wobble is insufficient.
export function pathChanged(before, after, notes) {
  const normalize = x => String(x || '').toLowerCase().replace(/\d+(?:\.\d+)?\s*%/g, '').replace(/\s+/g,' ').trim();
  return !!before && !!after && normalize(before) !== normalize(after) && notes.some(n =>
    /\b(no longer|instead of|rather than|shift(?:ed|s)? (?:from|toward)|now expect|previously expected|ceased|abandon(?:ed)?|revers(?:ed|al)|ended|suspended)\b/i.test(String(n.whyChanged || '')));
}
export function selectInputs(raw, weekEnding) {
  assertSunday(weekEnding);
  const start = dayPlus(weekEnding,-6), birthStart = dayPlus(start,-30), nextEnd = dayPlus(weekEnding,7);
  const archives = sorted(raw.archives.filter(a => a.id >= `archive#${birthStart}` && a.id <= `archive#${weekEnding}`));
  const all = archives.flatMap(a => (a.entries || []).map(e => ({...e,date:a.id.slice(8),archive:a.id})));
  const week = all.filter(e => e.date >= start);
  const ids = [...new Set(week.map(e => e.threadId).filter(Boolean))].sort();
  const links = sorted(raw.web?.index?.links || raw.web?.links || []);
  const histories = sorted((raw.summary || []).filter(r => r.SK?.startsWith('THREAD_HISTORY#') && dateOf(r) <= weekEnding));
  const drift = sorted((raw.summary || []).filter(r => /^(DRIFT|DRIFTLOG)#/.test(r.SK || '') && dateOf(r) >= start && dateOf(r) <= weekEnding));
  const predictions = sorted((raw.predictions || []).filter(r => String(r.PK).startsWith('PRED#') && String(r.SK).slice(0,10) <= weekEnding));
  const questions = sorted((raw.predictions || []).filter(r => String(r.PK).startsWith('Q#')));
  const stories = ids.map(threadId => {
    const entries = sorted(week.filter(e => e.threadId === threadId));
    const past = all.filter(e => e.threadId === threadId).sort((a,b) => a.date.localeCompare(b.date) || String(a.topicId).localeCompare(String(b.topicId)));
    const h = histories.filter(r => r.PK === `THREAD#${threadId}`).sort((a,b) => dateOf(a).localeCompare(dateOf(b)));
    const analysis = (raw.summary || []).find(r => r.PK === `THREAD#${threadId}` && r.SK === 'THREAD_ANALYSIS');
    const analysisDate = analysis && String(analysis.generatedAt || analysis.updatedAt || '').slice(0,10);
    const current = analysisDate && analysisDate <= weekEnding ? analysis : h.at(-1);
    const riskScore = Number.isFinite(current?.riskScore) ? current.riskScore : null;
    const outlets = [...new Set(entries.flatMap(e => (e.sources || []).map(s => s.source).filter(Boolean)))].sort();
    const linked = links.filter(l => (l.from === threadId && all.some(e=>e.threadId===l.to)) || (l.to === threadId && all.some(e=>e.threadId===l.from)));
    const sources = sorted(entries.flatMap(e => (e.sources || []).filter(s => s.source).map(s => ({outlet:s.source,archive:e.archive,...(e.topicId?{topicId:e.topicId}:{}),...(s.url?{url:s.url}:{})}))));
    const before = h.filter(r => dateOf(r) < start).at(-1);
    const during = h.filter(r => dateOf(r) >= start);
    const notes = drift.filter(r => r.PK === `THREAD#${threadId}`);
    const from = before?.riskScore, to = current?.riskScore;
    // A latest reading alone is not evidence that a 10-point movement held.
    const scoreHeld = Number.isFinite(from) && Number.isFinite(to) && Math.abs(to-from)>=10 && during.length>=2 &&
      during.slice(-2).every(r => Number.isFinite(r.riskScore) && Math.sign(r.riskScore-from)===Math.sign(to-from) && Math.abs(r.riskScore-from)>=10);
    const movedKind = riskScore >= 25 && before && notes.length ? (pathChanged(before.trajectory,current?.trajectory,notes)?'path':scoreHeld?'score':null) : null;
    const topicIds = new Set(past.map(e => e.topicId));
    const logged = predictions.filter(r => topicIds.has(String(r.PK).slice(5)) || r.threadId === threadId || r.clusterKey === threadId);
    return {threadId,title:current?.threadTitle || current?.title || past.at(-1)?.title || threadId,firstSeen:past[0].date,
      birthWindowLimited:past[0].date===birthStart,outlets,risk: riskScore===null?null:{score:riskScore,tier:tierFromScore(riskScore)},
      singleOutlet:outlets.length===1,event:entries.some(eventEvidence),links:linked,sources,entries,
      analysis:current || null,history:h,drift:notes,predictions:logged,
      moved: movedKind?{kind:movedKind,before:before.trajectory || '',after:current?.trajectory || '',scoreFrom:from,scoreTo:to}:null};
  });
  const rank = (a,b) => Number(a.singleOutlet)-Number(b.singleOutlet) || b.links.length-a.links.length || (b.risk?.score ?? -1)-(a.risk?.score ?? -1) || a.threadId.localeCompare(b.threadId);
  const fresh = stories.filter(s => s.firstSeen>=start);
  const qualified = fresh.filter(s => s.event && (s.links.length || (s.risk?.score>=50 && s.outlets.length>=2))).sort(rank);
  const moved = stories.filter(s => s.firstSeen<start && s.moved).sort(rank).slice(0,SECTIONS.find(s=>s.key==='moved').max);
  const trace = stories.filter(s => s.predictions.length).sort(rank);
  const dates = [];
  for (const s of stories) for (const p of s.predictions) for (const scenario of p.scenarios || []) for (const trigger of scenario.triggers || []) {
    const date = String(trigger.deadline || '').slice(0,10);
    if(date>weekEnding && date<=nextEnd) dates.push({date,what:trigger.text,kind:'trigger',threadId:s.threadId,p:trigger.p ?? scenario.probability,logged:{PK:p.PK,SK:p.SK}});
  }
  for(const q of questions.filter(q=>q.SK==='SAMPLED')) {
    const date=String(q.deadline || '').slice(0,10);
    if(date>weekEnding && date<=nextEnd) dates.push({date,what:q.claim || q.question || q.text || q.trigger?.text || '',kind:'forecast_due',threadId:q.clusterKey,question:q});
  }
  const missingDays=Array.from({length:7},(_,i)=>dayPlus(start,i)).filter(d=>!archives.some(a=>a.id===`archive#${d}`));
  const body={version:1,weekEnding,weekStart:start,birthWindowStart:birthStart,nextWeekEnd:nextEnd,
    candidates:{lead:[...stories].sort(rank),moved,trace,new:qualified.slice(0,3),dates:sorted(dates)},
    excludedNew:fresh.filter(s=>!qualified.includes(s)).map(s=>({threadId:s.threadId,reason:!s.event?'No completed event in headline': 'No tracked links or elevated risk with two outlets'})),
    overflowNew:qualified.slice(3).map(s=>s.threadId),
    coverage:{stories:ids.length,entries:week.length,outlets:new Set(week.flatMap(e=>(e.sources || []).map(s=>s.source).filter(Boolean))).size,missingDays,
      analysedNew:{analysed:fresh.filter(s=>s.analysis).length,total:fresh.length},corrections:[],
      note:'Birth dates are earliest observed archive dates within the stated lookback; missing days can delay observed births. No corrections store exists.'},
    evidence:{archives,summary:sorted(raw.summary || []),predictions:sorted(raw.predictions || []),web:raw.web || {},countryDrift:drift.filter(r=>r.PK?.startsWith('COUNTRY#'))}};
  return {...body,inputsHash:hashInputs(body)};
}
