#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {canonical,hashInputs,assertSunday,dayPlus} from './selection.mjs';
const require=createRequire(import.meta.url);
const {SECTIONS}=require('./sections.js');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const Ajv=createRequire(path.join(root,'global-perspectives-starter/frontend/package.json'))('ajv');
const validate=new Ajv({allErrors:true,strict:false}).compile(JSON.parse(readFileSync(new URL('./schema/weekly.schema.json',import.meta.url))));
const tokens = x => String(x).replace(/(?<=\d),(?=\d)/g,'').match(/(?<![\w])\d+(?:\.\d+)?/g) || [];
const nums = x => new Set(tokens(typeof x==='string'?x:JSON.stringify(x)).map(Number));
const words = x => String(x).trim().split(/\s+/).filter(Boolean).length;
function strings(x){if(typeof x==='string')return [x];if(!x||typeof x!=='object')return [];return Object.values(x).flatMap(strings);}
export function schemaErrors(week) { return validate(week)?[]:validate.errors.map(e=>`${e.instancePath || e.dataPath || '/'}: ${e.message}`); }
export function checkWeekly(week,inputs) {
  const errors=[],reports=[];const fail=(p,m)=>errors.push(`${p}: ${m}`);
  errors.push(...schemaErrors(week));
  try{assertSunday(week.weekEnding);}catch(e){fail('weekEnding',e.message);}
  if(inputs.inputsHash!==hashInputs(inputs))fail('inputsHash','inputs file was modified after hashing');
  if(week.inputsHash!==inputs.inputsHash)fail('inputsHash','does not match inputs');
  if(week.weekEnding!==inputs.weekEnding)fail('weekEnding','does not match inputs');
  const stories=inputs.candidates?.lead || [];
  const byId=new Map(stories.map(s=>[s.threadId,s]));
  const known=new Set(byId.keys());
  for(const l of inputs.evidence?.web?.index?.links || inputs.evidence?.web?.links || []){known.add(l.from);known.add(l.to);}
  for(const e of inputs.evidence?.archives || [])for(const row of e.entries || [])if(row.threadId)known.add(row.threadId);
  for(const q of inputs.evidence?.predictions || []) {if(q.threadId)known.add(q.threadId);if(q.clusterKey)known.add(q.clusterKey);}
  const allNumbers=nums(inputs);
  const storyNumbers=new Map(stories.map(s=>[s.threadId,nums(s)]));
  const inputDates=new Set(strings(inputs).flatMap(s=>s.match(/\d{4}-\d{2}-\d{2}/g)||[]));
  function visit(x,p='',story=null) {
    if(!x || typeof x!=='object')return;
    if(x.threadId) {if(!known.has(x.threadId))fail(`${p}.threadId`,'not present in inputs');story=byId.get(x.threadId)||story;}
    if(typeof x==='object' && !Array.isArray(x)) {
      if('label' in x && (x.label!=='judgment'||!['low','medium','high'].includes(x.confidence)))fail(p,'judgment needs label and confidence');
      if('sources' in x) {
        for(const source of x.sources || [])if(!story?.sources.some(s=>canonical(s)===canonical(source)))fail(`${p}.sources`,'citation is absent from this story in inputs');
        const entries=(story?.archiveEntries || story?.entries || []).filter(e=>(x.sources || []).some(s=>s.archive===e.archive && s.topicId===e.topicId));
        const evidenceText=entries.flatMap(e=>(e.sources || []).filter(s=>(x.sources || []).some(c=>c.outlet===s.source && (!c.url || c.url===s.url))).map(s=>`${s.title || ''} ${s.snippet || ''}`)).join(' ');
        for(const n of tokens(x.text))if(!nums(evidenceText).has(Number(n)))fail(`${p}.text`,`number ${n} is absent from cited entry text`);
      }
      for(const [k,v] of Object.entries(x)) {
        if(k==='by' || (k==='date' && !p.includes('.steps['))) {
          if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v||v<=week.weekEnding)fail(`${p}.${k}`,'must be a valid date after the week Sunday');
          else if(!inputDates.has(v))fail(`${p}.${k}`,'date is absent from inputs');
        }
        if(typeof v==='number' && k!=='p' && !allNumbers.has(v))fail(`${p}.${k}`,`number ${v} is absent from inputs`);
        if(typeof v==='string' && !['inputsHash','generatedAt','producer','threadId','url','topicId','archive'].includes(k)) {
          const scope = story?storyNumbers.get(story.threadId):allNumbers;
          for(const n of tokens(v))if(!scope.has(Number(n)) && !['by','date'].includes(k))fail(`${p}.${k}`,`number ${n} is absent from this item's inputs`);
        }
        visit(v,`${p}.${k}`,story);
      }
    }else x.forEach((v,i)=>visit(v,`${p}[${i}]`,story));
  }
  visit(week,'week');
  for(const [key,required] of [['new',inputs.candidates?.new || []],['moved',inputs.candidates?.moved || []]]) {
    const actual=(week[key] || []).map(s=>s.threadId).sort();
    if(canonical(actual)!==canonical(required.map(s=>s.threadId).sort()))fail(key,'must contain exactly the selected candidates');
  }
  for(const s of week.new || []) {
    const c=byId.get(s.threadId);if(!c)continue;
    if(s.firstSeen!==c.firstSeen)fail('new.firstSeen','differs from earliest observed archive date');
    if(canonical(s.outlets)!==canonical(c.outlets))fail('new.outlets','differs from inputs');
    if(c.singleOutlet && !/\b(one|single) source\b/i.test(s.fact?.text || ''))fail('new.fact','must say this rests on one source');
    for(const l of s.connectsTo || []) {
      if(!c.links.some(e=>(e.from===s.threadId && e.to===l.threadId)||(e.to===s.threadId && e.from===l.threadId)))fail('new.connectsTo','edge is absent from inputs');
      if(l.relation!=='possibly_related')fail('new.connectsTo','live inferred edges have no operator sign-off for defensible');
    }
  }
  for(const m of week.moved || []) {
    const c=byId.get(m.threadId)?.moved;
    if(!c || m.kind!==c.kind || m.before!==c.before || m.after!==c.after)fail('moved','kind and before/after must match selected logged trajectories');
    if(m.kind==='score' && (m.scoreFrom!==c?.scoreFrom || m.scoreTo!==c?.scoreTo))fail('moved','score endpoints differ from inputs');
  }
  for(const t of week.trace || []) {
    const c=byId.get(t.threadId);if(!c)continue;
    if(canonical(t.risk)!==canonical(c.risk))fail('trace.risk','does not match dated risk');
    for(const b of t.branches || []) {
      const matches=c.predictions.flatMap(p=>(p.scenarios || []).flatMap(sc=>(sc.triggers || []).map(tr=>({sc,tr}))));
      const probability=p=>Number(p)>1?Number(p)/100:Number(p);
      if(!matches.some(({sc,tr})=>tr.text===b.trigger && String(tr.deadline).slice(0,10)===b.by && probability(tr.p ?? sc.probability)===b.p))fail('trace.branches','trigger, deadline and probability must match one logged branch');
      if(b.status!=='not_checked')fail('trace.branches.status','trigger checks do not exist yet; must be not_checked');
    }
    for(const step of t.steps || [])if(!(c.archiveEntries || c.entries).some(e=>e.date===step.date && step.fact.sources.some(s=>s.archive===e.archive && s.topicId===e.topicId)))fail('trace.steps','step date must match its archive citation');
  }
  const dateKey=d=>canonical({date:d.date,what:d.what,kind:d.kind,threadId:d.threadId});
  if(canonical((week.dates || []).map(dateKey).sort())!==canonical(inputs.candidates.dates.map(dateKey).sort()))fail('dates','must retain every selected next-week occurrence; email limits do not trim the file');
  for(const d of week.dates || [])if(!inputs.candidates.dates.some(c=>c.date===d.date && c.threadId===d.threadId && c.kind===d.kind && c.what===d.what))fail('dates','must match a logged next-week date, claim and story');
  for(const k of ['stories','entries','outlets','missingDays','analysedNew','corrections'])if(canonical(week.coverage?.[k])!==canonical(inputs.coverage?.[k]))fail(`coverage.${k}`,'does not match counted inputs');
  for(const s of SECTIONS) {
    const value=week[s.key];if(s.max && Array.isArray(value)&&value.length>s.max)fail(s.key,`exceeds ${s.max} items`);
    const count=words(strings(value).join(' '));reports.push(`${s.title}: ${count} words; email target ${s.emailWordCap}${count>s.emailWordCap?' (over target; file remains complete)':''}`);
  }
  return {ok:errors.length===0,errors,reports};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try{const a=process.argv.slice(2);if(!a[0]||!a.includes('--inputs'))throw Error('Usage: check.mjs <week.json> --inputs <inputs.json>');const r=checkWeekly(JSON.parse(readFileSync(a[0])),JSON.parse(readFileSync(a[a.indexOf('--inputs')+1])));console.log(r.reports.join('\n'));if(!r.ok){console.error(r.errors.map(e=>`- ${e}`).join('\n'));process.exitCode=1;}else console.log('weekly check: OK');}catch(e){console.error(`check: ${e.message}`);process.exitCode=1;}
}
