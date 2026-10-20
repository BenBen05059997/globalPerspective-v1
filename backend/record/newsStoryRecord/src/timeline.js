'use strict';

const {createHash} = require('node:crypto');
const {day, lastStatus, live} = require('./rules');
const producer = `newsStoryRecord@${require('./package.json').version}`;
const LABELS = {
  entry:'fact', story_born:'fact', read_changed:'judgment', chapter:'judgment',
  forecast_drawn:'judgment', branch_status:'judgment', verdict:'fact', correction:'fact',
  link_confirmed:'judgment', country_read_changed:'judgment', situation:'fact', line:'judgment', coverage:'fact'
};
const ORDER = {story_born:0,entry:1,read_changed:2,chapter:3,forecast_drawn:4,branch_status:5,verdict:6,correction:7,link_confirmed:8,line:9,coverage:10};
const copy = value => JSON.parse(JSON.stringify(value));
const eventId = (kind, sourceKey) => createHash('sha1').update(kind + sourceKey).digest('hex');

function makeEvent({kind,sourceKey,at,threadId=null,iso3=[],actors=[],sources=[],payload,sourceRow,confidence}) {
  if (!LABELS[kind]) throw Error(`unknown timeline kind ${kind}`);
  if (typeof sourceKey !== 'string' || !sourceKey) throw Error('timeline sourceKey required');
  if (!sourceRow?.store || sourceRow.key == null) throw Error('timeline provenance required');
  if (!actors.every(a=>typeof a==='string') || !iso3.every(c=>typeof c==='string')) throw Error('timeline requires canonical actor/country names');
  const stamp = new Date(at).toISOString();
  if (confidence != null && !['low','medium','high'].includes(confidence)) throw Error('timeline confidence must use the documented tiers');
  return copy({eventId:eventId(kind,sourceKey),sourceKey,at:stamp,date:day(stamp),kind,threadId,
    iso3:[...new Set(iso3)].sort(),actors:[...new Set(actors)].sort(),sources,
    label:LABELS[kind],...(confidence?{confidence}:{}),payload,producer,sourceRow});
}

function cursorOf(days, date) {
  return Object.fromEntries(Object.keys(days).filter(d=>d<=date).sort().map(d=>[d,days[d].length]));
}

// A cursor is an immutable prefix of each daily file, so later arrivals in an older
// file cannot change the meaning of an already-written dated view.
function eventsThrough(days, cursor) {
  const seen = new Set();
  const events = [];
  for (const date of Object.keys(cursor).sort()) {
    const count = cursor[date];
    if (!Number.isSafeInteger(count) || count<0 || !days[date] || count>days[date].length) throw Error(`timeline cursor unavailable: ${date}`);
    for (const event of days[date].slice(0,count)) {
      if (event.date!==date) throw Error('timeline partition does not match event date');
      if (seen.has(event.eventId)) continue;
      seen.add(event.eventId);events.push(event);
    }
  }
  return events.sort((a,b)=>a.at.localeCompare(b.at) || (ORDER[a.kind]??99)-(ORDER[b.kind]??99) || (a.payload?.revision??0)-(b.payload?.revision??0));
}

function rebuildStory(days, threadId, {date,cursor=cursorOf(days,date)}={}) {
  const events = eventsThrough(days,cursor).filter(e=>e.threadId===threadId);
  if (!events.some(e=>e.kind==='story_born')) return null;
  const record = {threadId,born:null,bornAt:null,asOf:date,
    line:{text:'',writtenAt:date,versions:[]},chapters:[],events:[],forks:[],links:[],counts:{},
    actors:[],countries:[],risk:null,corrections:[],timelineCursor:copy(cursor)};
  const actors = new Set(),countries = new Set(),links = new Map(),drifts = new Map(),revisions = new Map();
  const findBranch = id => record.forks.flatMap(f=>f.branches).find(b=>b.branchId===id);
  const putLine = line => {
    if (record.line.text && record.line.writtenAt===line.writtenAt) return;
    const versions = record.line.text ? [...record.line.versions,{
      text:record.line.text,writtenAt:record.line.writtenAt,label:record.line.label,confidence:record.line.confidence
    }] : record.line.versions;
    record.line = {...copy(line),versions};
  };
  for (const event of events) {
    for (const a of event.actors) actors.add(a);
    for (const c of event.iso3) countries.add(c);
    const p = event.payload;
    switch (event.kind) {
      case 'story_born':
        if (!record.born) {record.born=p.born;record.bornAt=p.bornAt || event.at;if(p.birthEvidence)record.birthEvidence=copy(p.birthEvidence);}
        break;
      case 'entry': {
        const entry = copy(p.entry);
        if (!record.events.some(e=>entry.sourceKey ? e.sourceKey===entry.sourceKey : e.archive===entry.archive && e.topicId===entry.topicId)) {
          delete entry.driftNote;entry.killed=[];record.events.push(entry);
        }
        break;
      }
      case 'read_changed':
        if ('risk' in p) record.risk=p.risk;
        if (p.driftNote) drifts.set(p.driftDate || event.date,copy(p.driftNote));
        break;
      case 'line': putLine(p.line);break;
      case 'coverage': if(p.llm) record.llm=copy(p.llm);break;
      case 'chapter':
        if (!record.chapters.some(c=>c.startedAt===p.chapter.startedAt)) record.chapters.push(copy(p.chapter));
        break;
      case 'forecast_drawn':
        if (!record.forks.some(f=>f.forkId===p.fork.forkId)) {
          const fork=copy(p.fork);
          for (const branch of fork.branches) {branch.status=[];delete branch.scored;delete branch.verdicts;}
          record.forks.push(fork);
        }
        break;
      case 'branch_status': {
        const branch=findBranch(p.branchId);
        if (!branch) throw Error(`status has no forecast: ${p.branchId}`);
        if (p.changed!==false && (!branch.status.length || lastStatus(branch)!==p.row.status)) branch.status.push(copy(p.row));
        break;
      }
      case 'verdict': {
        const branch=findBranch(p.branchId);
        if (!branch) throw Error(`verdict has no forecast: ${p.branchId}`);
        if (!Number.isInteger(p.revision) || p.revision<1) throw Error('normalized verdict revision required');
        if (p.revision>(revisions.get(p.branchId)||0)) {
          revisions.set(p.branchId,p.revision);branch.verdicts ||= [];
          branch.verdicts.push(copy(p.scored));branch.scored=copy(p.scored);
        }
        break;
      }
      case 'correction':
        record.corrections.push({...copy(p.correction),eventId:event.eventId,corrects:p.corrects});
        break;
      case 'link_confirmed':
        if (p.link.confirmed!==true || p.link.confirmedBy!=='rule') throw Error('unconfirmed link in timeline');
        links.set(p.link.otherThreadId,copy(p.link));
        break;
      default: break;
    }
  }
  record.events.sort((a,b)=>a.date.localeCompare(b.date)||a.topicId.localeCompare(b.topicId));
  record.chapters.sort((a,b)=>a.startedAt.localeCompare(b.startedAt));
  record.forks.sort((a,b)=>a.drawnAt.localeCompare(b.drawnAt)||a.forkId.localeCompare(b.forkId));
  for (const entry of record.events) {
    if (drifts.has(entry.date)) entry.driftNote=copy(drifts.get(entry.date));
    entry.killed=record.forks.flatMap(f=>f.branches.filter(b=>b.status.some(s=>s.date===entry.date && s.status==='dead')).map(b=>b.branchId));
  }
  record.actors=[...actors].sort();record.countries=[...countries].sort();
  record.links=[...links.values()].sort((a,b)=>a.otherThreadId.localeCompare(b.otherThreadId));
  const branches=record.forks.flatMap(f=>f.branches);
  record.counts={events:record.events.length,forks:record.forks.length,liveBranches:branches.filter(live).length,
    deadBranches:branches.filter(b=>lastStatus(b)==='dead').length,corrections:record.corrections.length};
  return record;
}

module.exports={eventId,makeEvent,cursorOf,eventsThrough,rebuildStory};
