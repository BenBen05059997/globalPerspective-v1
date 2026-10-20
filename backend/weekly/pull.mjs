#!/usr/bin/env node
// Read-only AWS adapter. An injected client implements getArchive, summary, predictions, web.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { selectInputs, assertSunday, dayPlus } from './selection.mjs';
const exec = promisify(execFile);
export const DEFAULT_BUCKET = 'globalperspective-world-280362093938';
export function decode(v) {
  if(v.S!==undefined)return v.S;if(v.N!==undefined)return Number(v.N);if(v.BOOL!==undefined)return v.BOOL;if(v.NULL)return null;
  if(v.L)return v.L.map(decode);if(v.M)return Object.fromEntries(Object.entries(v.M).map(([k,x])=>[k,decode(x)]));
  if(v.SS)return [...v.SS].sort();if(v.NS)return v.NS.map(Number).sort((a,b)=>a-b);throw Error('Unsupported DynamoDB attribute type');
}
const item = x => Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)]));
export function makeReadClient({run=exec,region=process.env.AWS_REGION || 'ap-northeast-1',bucket=process.env.WORLD_BUCKET || DEFAULT_BUCKET}={}) {
  async function aws(args) {const {stdout}=await run('aws',[...args,'--region',region,'--output','json','--no-cli-pager','--cli-connect-timeout','10','--cli-read-timeout','30'],{maxBuffer:64*1024*1024,timeout:120000});return stdout.trim()?JSON.parse(stdout):{};}
  async function scan(table,filter,values) {
    let key;const rows=[];
    do {const r=await aws(['dynamodb','scan','--table-name',table,'--limit','100','--no-paginate','--filter-expression',filter,'--expression-attribute-values',JSON.stringify(values),...(key?['--exclusive-start-key',JSON.stringify(key)]:[])]);rows.push(...(r.Items || []).map(item));key=r.LastEvaluatedKey;} while(key && Object.keys(key).length);
    return rows;
  }
  return {
    async getArchive(date) {const r=await aws(['dynamodb','get-item','--table-name','NewsCache','--key',JSON.stringify({id:{S:`archive#${date}`}})]);return r.Item?item(r.Item):null;},
    summary:()=>scan('SummarizeAndPredict','begins_with(PK, :t) OR begins_with(PK, :c)',{':t':{S:'THREAD#'},':c':{S:'COUNTRY#'}}),
    predictions:()=>scan('GlobalPerspectivePredictionLog','begins_with(PK, :p) OR begins_with(PK, :q)',{':p':{S:'PRED#'},':q':{S:'Q#'}}),
    async web(){const {stdout}=await run('aws',['s3','cp',`s3://${bucket}/web/latest.json`,'-','--region',region,'--no-cli-pager'],{maxBuffer:16*1024*1024,timeout:120000});return JSON.parse(stdout);},
  };
}
export async function pull(weekEnding,client) {
  assertSunday(weekEnding);const archives=[];
  // Bound concurrency so a live pull remains a small read workload.
  const days=Array.from({length:37},(_,i)=>dayPlus(weekEnding,i-36));
  for(let i=0;i<days.length;i+=4) {const rows=await Promise.all(days.slice(i,i+4).map(d=>client.getArchive(d)));archives.push(...rows.filter(Boolean));}
  const summary=await client.summary();const predictions=await client.predictions();const web=await client.web();
  return selectInputs({archives,summary,predictions,web},weekEnding);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {const args=process.argv.slice(2);const week=args[args.indexOf('--week-ending')+1];if(!args.includes('--week-ending'))throw Error('Usage: pull.mjs --week-ending YYYY-MM-DD [--out path]');
    const result=await pull(week,makeReadClient());const out=args.includes('--out')?args[args.indexOf('--out')+1]:null;
    if(out)await writeFile(out,JSON.stringify(result,null,2)+'\n');else process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }catch(e){console.error(`pull: ${e.message}`);process.exitCode=1;}
}
