#!/usr/bin/env node
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertSunday,canonical} from './selection.mjs';
import {schemaErrors} from './check.mjs';
const require=createRequire(import.meta.url);
const {makeS3Json}=require('../shared/src/s3json.js');
export async function publish(week,store) {
  assertSunday(week.weekEnding);
  const errors=schemaErrors(week);if(errors.length)throw Error(`Invalid weekly schema: ${errors.join('; ')}`);
  if(week.status!=='draft' && week.status!=='published')throw Error('Only a draft or published week may be published');
  if(await store.getJson(`weekly/${week.weekEnding}.held.json`))throw Error('Week is held; refusing to republish');
  const value={...week,status:'published'},key=`weekly/${week.weekEnding}.json`;
  const wrote=await store.putOnce(key,value);
  if(!wrote) {const existing=await store.getJson(key);if(canonical(existing)!==canonical(value))throw Error('Weekly snapshot already exists with different content');}
  const latest=await store.getJson('weekly/latest.json');
  if(!latest || latest.weekEnding<=week.weekEnding)await store.putLatest('weekly/latest.json',value);
  return {key,created:wrote};
}
export async function liveStore() {
  const {S3Client,GetObjectCommand,PutObjectCommand}=require('@aws-sdk/client-s3');
  return makeS3Json({client:new S3Client({region:process.env.AWS_REGION || 'ap-northeast-1'}),GetObjectCommand,PutObjectCommand,bucket:process.env.WORLD_BUCKET || 'globalperspective-world-280362093938'});
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {if(!process.argv[2])throw Error('Usage: publish.mjs <checked-week.json>');console.log(await publish(JSON.parse(readFileSync(process.argv[2])),await liveStore()));}catch(e){console.error(`publish: ${e.message}`);process.exitCode=1;}
}
