'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
process.env.TOPICS_DDB_TABLE='topics';process.env.SUMMARIZE_PREDICT_TABLE='summary';
const calls=[];const original=Module._load;
Module._load=function(name,...args){
 if(name.startsWith('@aws-sdk/'))return new Proxy({}, {get:(_,key)=>{
  if(key==='DynamoDBDocumentClient')return{from:()=>({send:async command=>{calls.push(command.input);return{};}})};
  return class{constructor(input){this.input=input;}async send(command){calls.push(command.input);return{};}};
 }});
 return original.call(this,name,...args);
};
const{handler}=require('../src/index.js');Module._load=original;
const event=(action,payload={})=>({headers:{},httpMethod:'POST',body:JSON.stringify({action,payload})});
test('all seven removed actions reject without database, object or network work',async()=>{
 for(const action of ['event_dossier','dossier_analysis','pair_analysis','pair_analyses_list','world_overview','research_briefing','geocode']){
  const result=await handler(event(action,{topicId:'topic',address:'Kyiv',pair:'A-B',threadId:'story',countryName:'Iran'}));
  assert.equal(result.statusCode,400);assert.equal(JSON.parse(result.body).error,'Unsupported action');
 }
 assert.equal(calls.length,0);
});
test('economy actions remain routed and live summary/web reads still use the store',async()=>{
 for(const action of ['economic_impact','markets_country']){
  const result=await handler(event(action));assert.equal(result.statusCode,400);assert.notEqual(JSON.parse(result.body).error,'Unsupported action');
 }
 for(const action of ['economic_impact_list','economic_top_movers','weekly_markets'])assert.equal((await handler(event(action))).statusCode,200);
 const summary=await handler(event('summary',{topicId:'topic'}));assert.equal(summary.statusCode,503);
 assert.ok(calls.some(c=>c.Key?.SK==='SUMMARY'));
 const web=await handler(event('web_index'));assert.equal(web.statusCode,200);assert.ok(calls.some(c=>c.Key?.PK==='WEB#INDEX'));
});
