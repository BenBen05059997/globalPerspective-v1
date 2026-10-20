// Pure selection. No clock, network, model calls, or coverage-volume ranking.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const world = require('../shared/src/world');
const { SECTIONS } = require('./sections.js');
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(v=>canonical(v) ?? 'null').join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const hashInputs = ({ inputsHash, ...body }) => createHash('sha256').update(canonical(body)).digest('hex');
export const dayPlus = world.addDays;
export function assertSunday(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '') || dayPlus(day, 0) !== day || new Date(`${day}T00:00:00Z`).getUTCDay() !== 0) throw Error('week-ending must be a valid Sunday YYYY-MM-DD');
}
const sorted = xs => xs.map(value=>({value,key:canonical(value)})).sort((a,b)=>a.key.localeCompare(b.key)).map(x=>x.value);
export function eventEvidence(entry) {
  // Conservative lexical gate: a dated archive entry must name a completed action.
  // Unknown/non-events are kept in excluded with a reason, never guessed into new.
  const text = String(entry.title || '');
  const periodic = /\b(report|survey|outlook|forecast|weekly|monthly|annual|warns?|urges?|calls? for|says?|tells?)\b/i;
  const action = /\b(attack\w*|struck|strike\w*|hit|kills?|killed|die[sd]?|dead|collapse\w*|arrest\w*|elect\w*|resign\w*|launch\w*|fire[sd]?|caught fire|bomb\w*|signs?|signed|approv\w*|suspend\w*|halt\w*|shut\w*|seiz\w*|board\w*|clash\w*|endorse\w*|overtur\w*|flood\w*|landfall|begins?|began|impos\w*|releas\w*|detain\w*)\b/i;
  return !/\b(report|survey|outlook|forecast|weekly|monthly|annual|will|could|may|might|plans?|planned|expected|threatens?|vows?)\b/i.test(text) && action.test(text) && (!periodic.test(text) || /\b(attack\w*|struck|killed|collapse\w*|arrest\w*|caught fire|shut\w*|clash\w*)\b/i.test(text));
}
// Path changes need an explicit directional signal in the logged explanation and
// different trajectory text; a mere rewrite or probability wobble is insufficient.
export function pathChanged(before, after, notes) {
  const normalize = x => String(x || '').toLowerCase().replace(/\d+(?:\.\d+)?\s*%/g, '').replace(/\s+/g,' ').trim();
  return !!before && !!after && normalize(before) !== normalize(after) && notes.some(n => {
    const text=String(n.whyChanged || '');
    // A changed title, score justification or "rather than escalation" is not
    // an explicit revision of an expectation. Fail closed on ambiguous prose.
    return /\b(?:no longer|now|previously|instead)\s+(?:\w+\s+){0,3}(?:expect|expected|forecast|anticipate|anticipating)\b/i.test(text) ||
      /\b(?:expected path|expected outcome|forecast|trajectory|outlook)\b.{0,80}\b(?:changed|shifted|reversed|abandoned)\b/i.test(text);
  });
}
export function selectInputs(data, weekEnding) {
  assertSunday(weekEnding);
  const start = dayPlus(weekEnding,-6), birthStart = dayPlus(start,-30), nextEnd = dayPlus(weekEnding,7);
  const {range} = data;
  const questions=sorted(data.questions || []);
  const grouped = world.entriesByThread(range);
  const births = world.birthByThread(range);
  const links = sorted(data.web?.index?.links || []);
  const activeIds = Object.keys(grouped).filter(id=>grouped[id].some(e=>e.date>=start)).sort();
  const resolved = Object.fromEntries(activeIds.map(id=>[id,world.analysisAsOf(data.analyses[id],data.histories[id] || [],weekEnding)]));
  const counts = world.coverage(range,{since:start,births,analyses:resolved});
  const stories = activeIds.map(threadId => {
    const past = grouped[threadId], entries = past.filter(e=>e.date>=start);
    const history = data.histories[threadId] || [], current = resolved[threadId];
    const notes = data.driftByThread[threadId] || [];
    const riskScore = current?.riskScore ?? null;
    const outlets = world.outletsOf(entries);
    const linked = links.filter(l=>(l.from===threadId && grouped[l.to]) || (l.to===threadId && grouped[l.from]));
    const sources = sorted(past.flatMap(e=>e.sources.filter(s=>s.source).map(s=>({outlet:world.outletName(s.source),archive:e.archive,...(e.topicId?{topicId:e.topicId}:{}),...(s.url?{url:s.url}:{})}))));
    const before = history.filter(h=>h.date<start).at(-1), during = history.filter(h=>h.date>=start && h.date<=weekEnding);
    const from=before?.score, to=riskScore;
    const scoreHeld=Number.isFinite(from) && Number.isFinite(to) && Math.abs(to-from)>=10 && during.length>=2 &&
      during.slice(-2).every(h=>Number.isFinite(h.score) && Math.sign(h.score-from)===Math.sign(to-from) && Math.abs(h.score-from)>=10);
    const movedKind = riskScore>=25 && before && notes.length ? (pathChanged(before.trajectory,current?.trajectory,notes)?'path':scoreHeld?'score':null) : null;
    const predictions=data.snapshotsByThread[threadId] || [];
    return {threadId,title:current?.title || past.at(-1).title,firstSeen:births[threadId].born,
      birthWindowLimited:births[threadId].windowLimited,birth:births[threadId],outlets,
      risk:riskScore===null?null:{score:riskScore,tier:current.tier},
      pathReview:!!before && !!current?.trajectory && before.trajectory!==current.trajectory && !movedKind,
      singleOutlet:outlets.length===1,event:entries.some(eventEvidence),links:linked,sources,entries,archiveEntries:past,
      analysis:current,history,drift:notes,predictions,forks:world.branchesFromScenarios(predictions),
      moved:movedKind?{kind:movedKind,before:before.trajectory || '',after:current?.trajectory || '',scoreFrom:from,scoreTo:to}:null};
  });
  const tierRank=s=>({low:0,moderate:1,elevated:2,high:3}[s.risk?.tier] ?? -1);
  const rank=(a,b)=>Number(a.singleOutlet)-Number(b.singleOutlet) || b.links.length-a.links.length || tierRank(b)-tierRank(a) || a.threadId.localeCompare(b.threadId);
  const fresh=stories.filter(s=>s.firstSeen>=start);
  const qualified=fresh.filter(s=>s.event && (s.links.length || (s.risk?.score>=50 && s.outlets.length>=2))).sort(rank);
  const moved=stories.filter(s=>s.firstSeen<start && s.moved).sort(rank).slice(0,SECTIONS.find(s=>s.key==='moved').max);
  const trace=stories.filter(s=>s.forks.length).sort(rank);
  const dates=[];
  for(const s of stories) for(const fork of s.forks) for(const branch of fork.branches) {
    if(branch.due>weekEnding && branch.due<=nextEnd)dates.push({date:branch.due,what:branch.trigger,kind:'trigger',threadId:s.threadId,p:branch.p,scenarioP:branch.scenarioP,forkId:fork.forkId,branchId:branch.branchId});
  }
  for(const q of questions)if(q.deadline>weekEnding && q.deadline<=nextEnd)dates.push({date:q.deadline,what:q.question,kind:'forecast_due',threadId:q.threadId,question:q});
  const body={version:2,weekEnding,weekStart:start,birthWindowStart:birthStart,nextWeekEnd:nextEnd,
    candidates:{lead:[...stories].sort(rank),moved:moved.map(s=>({threadId:s.threadId,title:s.title,moved:s.moved})),
      trace:trace.map(s=>({threadId:s.threadId,title:s.title,risk:s.risk,forks:s.forks})),
      new:qualified.slice(0,3).map(s=>({threadId:s.threadId,title:s.title,firstSeen:s.firstSeen,outlets:s.outlets,risk:s.risk,singleOutlet:s.singleOutlet,links:s.links})),
      dates:sorted([...new Map(dates.map(d=>[canonical({date:d.date,what:d.what,kind:d.kind,threadId:d.threadId}),d])).values()])},
    excludedNew:fresh.filter(s=>!qualified.includes(s)).map(s=>({threadId:s.threadId,reason:!s.event?'No completed event in headline':'No tracked links or elevated risk with two outlets'})),
    overflowNew:qualified.slice(3).map(s=>s.threadId),
    pathReviewCandidates:stories.filter(s=>s.pathReview).map(s=>({threadId:s.threadId,reason:'Trajectory prose differs but no explicit logged revision or sustained score move establishes a changed expected path'})),
    coverage:{stories:counts.stories,entries:counts.entries,outlets:counts.outlets,missingDays:counts.missingDays,analysedNew:counts.analysedNew,corrections:[],
      note:'Birth dates are earliest observed archive dates within the stated lookback; missing days can delay observed births. No corrections store exists.'},
    evidence:{range,coverage:counts,births,web:data.web,webSource:data.webSource,countryDrift:sorted(data.countryDrift || []),countryHistory:data.countryHistory || {},questions,verdicts:data.verdicts || {}}};
  return {...body,inputsHash:hashInputs(body)};
}
