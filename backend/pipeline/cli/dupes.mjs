#!/usr/bin/env node
// Read-only archive audit. Candidates require review; similarity is not event identity.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const { normalizeTitle, joinScore, passesJoin } = createRequire(import.meta.url)('../NewsProjectInvokeAgentLambda/src/threading.js');
export function unmarshal(a) {
  if ('S' in a) return a.S;
  if ('N' in a) return Number(a.N);
  if ('L' in a) return a.L.map(unmarshal);
  if ('M' in a) return Object.fromEntries(Object.entries(a.M).map(([k,v]) => [k, unmarshal(v)]));
  if ('SS' in a) return a.SS;
  if ('BOOL' in a) return a.BOOL;
  return null;
}
export function dayRange(from, to) {
  for (const d of [from,to]) if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '') || !Number.isFinite(Date.parse(d)) || new Date(d).toISOString().slice(0,10) !== d) throw new Error('Use valid --from/--to YYYY-MM-DD');
  if (from > to || (Date.parse(to)-Date.parse(from))/86400000 > 90) throw new Error('Range must be ordered and at most 91 days');
  const days=[];
  for(let ms=Date.parse(from);ms<=Date.parse(to);ms+=86400000) days.push(new Date(ms).toISOString().slice(0,10));
  return days;
}
export function audit(days, { since = null, method = 'current' } = {}) {
  const rows=Object.entries(days).flatMap(([day,entries])=>entries.map((e,index)=>({ ...e, day, index })));
  const pairs=[];
  for(let i=0;i<rows.length;i++) for(let j=i+1;j<rows.length;j++) {
    const a=rows[i], b=rows[j];
    if(!a.threadId || !b.threadId || Math.abs(Date.parse(a.day)-Date.parse(b.day))>7*86400000) continue;
    if(since && ![a,b].some(e=>Date.parse(e.archivedAt)>=Date.parse(since))) continue;
    const norm=normalizeTitle, title=norm(a.title), other=norm(b.title);
    const exact=Boolean(title) && title===other;
    const continuation=(Boolean(norm(a.continues_topic)) && norm(a.continues_topic)===other) || (Boolean(norm(b.continues_topic)) && norm(b.continues_topic)===title);
    const score=joinScore(a,b);
    const urls=new Set((a.sources||[]).map(s=>s.url).filter(Boolean));
    const sharedUrls=[...new Set((b.sources||[]).map(s=>s.url).filter(u=>u && urls.has(u)))];
    const titleTokens=t=>new Set(normalizeTitle(t).split(' ').filter(Boolean));
    const ta=titleTokens(a.title),tb=titleTokens(b.title);
    const titleJaccard=[...ta].filter(t=>tb.has(t)).length/(new Set([...ta,...tb]).size||1);
    const shared=(xs,ys)=>xs.some(x=>ys.includes(x));
    const countries=e=>[...(e.regions||[]),...(e.iso3||[])].map(x=>String(x).toLowerCase().trim());
    const actorNames=e=>(e.actors||[]).map(x=>String(x).toLowerCase().trim());
    const sharedCountry=shared(countries(a),countries(b));
    const sharedIso=shared((a.iso3||[]),(b.iso3||[]));
    const sharedActor=shared(actorNames(a),actorNames(b));
    const taMs=Date.parse(a.archivedAt),tbMs=Date.parse(b.archivedAt);
    const reviewMethodMatch=Math.abs(taMs-tbMs)<=72*3600000 && ((titleJaccard>=0.5&&sharedCountry)||(titleJaccard>=0.34&&sharedActor&&sharedIso));
    const different=a.threadId!==b.threadId;
    if(method==='review' && (different ? !reviewMethodMatch : true)) continue;
    if(method!=='review' && (different ? !(exact||continuation||sharedUrls.length||passesJoin(score)) : (exact||continuation||passesJoin(score)))) continue;
    const evidence=e=>({day:e.day,index:e.index,topicId:e.topicId,threadId:e.threadId,title:e.title,archivedAt:e.archivedAt,generationId:e.generationId});
    pairs.push({titleJaccard,reviewMethodMatch,sharedCountry,sharedActor,kind:different?'duplicate-candidate':'mixed-thread-candidate', evidence:exact?'normalized-title':continuation?'continues_topic':sharedUrls.length?'shared-source-url':different?(method==='review'?'review-method':'join-score'):'fails-current-join',...score,sharedUrls,a:evidence(a),b:evidence(b)});
  }
  return { disclaimer:'Pair evidence only: no semantic identity claim; mixed candidates may be legitimate evolving threads. Archive rows are mutable and may omit earlier runs.', rows:rows.length, threads:new Set(rows.map(e=>e.threadId).filter(Boolean)).size, pairs };
}
export function readDays(from,to) {
 const days={};
 for(const day of dayRange(from,to)) {
  const output=execFileSync('aws',['dynamodb','get-item','--table-name','NewsCache','--key',JSON.stringify({id:{S:`archive#${day}`}}),'--projection-expression','entries','--consistent-read','--region','ap-northeast-1','--output','json','--cli-connect-timeout','10','--cli-read-timeout','30'],{encoding:'utf8',maxBuffer:8*1024*1024});
  const raw=output.trim()?JSON.parse(output):{};
  days[day]=raw.Item?unmarshal({M:raw.Item}).entries||[]:[];
 }
 return days;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 try {
  const args=process.argv.slice(2), allowed=new Set(['--from','--to','--since','--method']);
  const opts={};
  for(let i=0;i<args.length;i+=2) { if(!allowed.has(args[i]) || !args[i+1]) throw new Error('usage: dupes.mjs --from YYYY-MM-DD --to YYYY-MM-DD [--since ISO_TIMESTAMP] (read-only)'); opts[args[i].slice(2)]=args[i+1]; }
  dayRange(opts.from,opts.to);
  if(opts.method && !['current','review'].includes(opts.method)) throw new Error('--method must be current or review');
  if(opts.since && !Number.isFinite(Date.parse(opts.since))) throw new Error('Invalid --since timestamp');
  console.log(JSON.stringify({from:opts.from,to:opts.to,since:opts.since||null,...audit(readDays(opts.from,opts.to),opts)},null,2));
 } catch(e) {console.error(e.message);process.exitCode=1;}
}
