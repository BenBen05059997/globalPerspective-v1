'use strict';
const {makeHandler}=require('./index');
const {makeStore}=require('./store');
const world=require('./_shared/world');
const {makeS3Json}=require('./_shared/s3json');

// Select a key here; parsing the returned object remains world/'s job.
async function readWebAsOf(client,date) {
  const web=await world.webAt(client,date,{fallback:'latest'});
  return web && world.day(web.generatedAt)<=date?web:null;
}

exports.handler=async(event={})=>{
  const shadow=event.shadow ?? true;
  // A no-LLM run marks stories complete for the date, so it may only write the shadow tree.
  if(event.noLlm && !shadow)throw Error('noLlm runs are shadow-only');
  const {DynamoDBClient}=require('@aws-sdk/client-dynamodb');
  const {DynamoDBDocumentClient,GetCommand,QueryCommand,BatchGetCommand,ScanCommand}=require('@aws-sdk/lib-dynamodb');
  const {S3Client,GetObjectCommand,PutObjectCommand}=require('@aws-sdk/client-s3');
  const ddb=DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const s3json=makeS3Json({client:new S3Client({}),GetObjectCommand,PutObjectCommand,bucket:process.env.WORLD_BUCKET});
  const client=world.makeClient(world.makeDynamoClient({client:ddb,GetCommand,QueryCommand,BatchGetCommand,ScanCommand}),{getS3Json:s3json.getJson});
  if(!process.env.RECORD_LLM_MODEL && !event.noLlm)throw Error('RECORD_LLM_MODEL required');
  // After an auth or credit failure (401/402/403) every later call fails fast instead of waiting on the provider;
  // each story still fails on its own and is retried next run.
  let refused=null;
  const llm=event.noLlm?null:async(prompt)=>{
    if(refused)throw refused;
    const {chat,parseJsonContent}=require('./_shared/llm');
    try {
      const r=await chat({step:`record_${prompt.task}`,model:process.env.RECORD_LLM_MODEL,user:JSON.stringify(prompt),maxTokens:1200,temperature:0,json:true});
      return parseJsonContent(r.content);
    } catch(e) {
      if([401,402,403].includes(e.status))refused=e;
      throw e;
    }
  };
  return makeHandler({store:makeStore(client,{env:process.env,readWeb:date=>readWebAsOf(client,date)}),s3json,llm})({...event,shadow});
};
exports.readWebAsOf=readWebAsOf;
