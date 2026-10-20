const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createRequire}=require('node:module');
function harness(){
 const writes=[];const real=createRequire(require.resolve('../src/index.js'));
 const commands=Object.fromEntries(['GetCommand','PutCommand','QueryCommand'].map(kind=>[kind,class {constructor(input){this.kind=kind;this.input=input;}}]));
 const client={send:async c=>{if(c.kind==='PutCommand')writes.push(c.input.Item);return {};}};
 const context={exports:{},require:n=>n==='@aws-sdk/client-dynamodb'?{DynamoDBClient:class{}}:n==='@aws-sdk/lib-dynamodb'?{...commands,DynamoDBDocumentClient:{from:()=>client}}:real(n),process:{env:{}},console,Date,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/index.js'),'utf8'),context);
 return {write:context.exports._internal.logPredictionSnapshot,writes};
}
test('PRED writer persists category, stable fork identity and positional scenario identity',async()=>{
 const h=harness();const topic={id:'one',title:'Test',categories:['military','politics']};
 await h.write(topic,JSON.stringify({scenarios:[{scenario:'Likely',triggers:[]},{scenario:'Other',triggers:[]}]}),{modelId:'fake'},'gen',2026,{threadIdById:{one:'thread-existing'}});
 assert.equal(h.writes.length,1);const r=h.writes[0];
 assert.equal(r.category,'military');assert.equal(r.threadId,'thread-existing');
 assert.equal(r.forkId,`${r.PK}|${r.SK}`);
 assert.equal(JSON.stringify(r.scenarios.map(s=>s.scenarioIndex)),'[0,1]');
});
test('PRED writer always assigns a thread and accepts older singular categories',async()=>{
 const h=harness();await h.write({id:'old',title:'Old',category:'economy'},JSON.stringify({scenarios:[]}),{modelId:'fake'},'gen',2026);
 assert.equal(h.writes.length,1);assert.match(h.writes[0].threadId,/^thread-/);assert.equal(h.writes[0].category,'economy');
});
