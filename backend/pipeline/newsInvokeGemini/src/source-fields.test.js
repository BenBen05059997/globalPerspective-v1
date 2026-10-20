const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {createRequire} = require('node:module');
function load(file) {
 const real = createRequire(require.resolve(file));
 const context = {exports:{},require:n=>n==='@aws-sdk/client-dynamodb'?{DynamoDBClient:class{}}:n==='@aws-sdk/lib-dynamodb'?{DynamoDBDocumentClient:{from:()=>({})}}:real(n),process:{env:{}},console,Date,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(require.resolve(file),'utf8'), context);
 return context.exports._internal;
}
const {parseRssXml} = load('./index.js');
const {buildArchiveEntry} = load('../../NewsProjectInvokeAgentLambda/src/index.js');
const {sourceWithPublication,enrichSourcesForTopic} = require('./source_enrichment');
const {parseRss} = require('../../../situations/newsSituationIngest/src/index.js')._internal;
const {normalizeClassified,splitByCache,cacheKey} = require('../../../situations/newsSituationIngest/src/classifier-core');
const xml = '<rss><item><title>Flood emergency</title><link>https://bbc.com/a</link><pubDate>Tue, 20 Oct 2026 09:30:00 +0900</pubDate></item></rss>';
test('selector retains UTC publication and relative age; missing/invalid date remains null',()=>{
 const a=parseRssXml(xml,'bbc.com')[0];
 assert.equal(a.publishedAt,'2026-10-20T00:30:00.000Z');assert.equal(typeof a.age,'string');
 for(const x of [xml.replace(/<pubDate>.*?<\/pubDate>/,''),xml.replace('Tue, 20 Oct 2026 09:30:00 +0900','bad')])assert.equal(parseRssXml(x,'bbc.com')[0].publishedAt,null);
});
test('primary and enriched source dates are RSS values and archive preserves sources unchanged',()=>{
 const a=parseRssXml(xml,'bbc.com')[0];
 const source=sourceWithPublication({url:a.url,publishedAt:'invented'},[a]);
 assert.equal(source.publishedAt,a.publishedAt);
 assert.equal(sourceWithPublication({url:'old'},[]).publishedAt,null);
 const enriched=enrichSourcesForTopic({title:a.title,sources:[]},[a],new Set(),{threshold:0})[0];
 assert.equal(enriched.publishedAt,a.publishedAt);
 const entry=buildArchiveEntry({id:'t',title:'Flood',sources:[source,enriched]},null,'g',10,'thread-t');
 assert.equal(entry.sources[0],source);assert.equal(entry.sources[1],enriched);
});
test('map RSS timestamp survives normalization and upgrades an old cache hit',()=>{
 const a=parseRss(xml,'bbc.com')[0];const c=normalizeClassified({axis:'humanitarian'},a);
 assert.equal(c.publishedAt,'2026-10-20T00:30:00.000Z');
 const old={...c};delete old.publishedAt;
 assert.equal(splitByCache([a],{entries:{[cacheKey(a)]:{c:old}}}).hits[0].publishedAt,c.publishedAt);
 assert.equal(normalizeClassified({}, {title:'Old',url:'https://bbc.com/old'}).publishedAt,null);
});

test('one outlet table supplies primary, enriched and map names; unknowns stay null',()=>{
 const {annotateSourcesWithMetadata} = require('./source_enrichment');
 const topics=[{sources:[{source:'WWW.BBC.COM'},{source:'unknown.example'}]}];
 annotateSourcesWithMetadata(topics);
 assert.equal(topics[0].sources[0].outlet,'BBC');assert.equal(topics[0].sources[1].outlet,null);
 const c=normalizeClassified({}, {title:'T',url:'https://bbc.com/a',source:'bbc.com'});
 assert.equal(c.outlet,'BBC');
 assert.equal(normalizeClassified({}, {title:'T',url:'https://unknown.example/a'}).outlet,null);
 const a={title:'T',url:'https://bbc.com/a',source:'bbc.com'};
 const old={...c,outlet:'bad'};
 assert.equal(splitByCache([a],{entries:{[cacheKey(a)]:{c:old}}}).hits[0].outlet,'BBC');
});

test('selector and map canonicalize aliases, drop plausible unknown codes and count logs',()=>{
 const selector=load('./index.js').canonicalIso3;
 const ingest=require('../../../situations/newsSituationIngest/src/classifier-core').canonicalIso3;
 for(const normalize of [selector,ingest]) {
  const logs=[];
  const actual=normalize([' usa ','USA','UK','ZZZ','XX','irn'],m=>logs.push(m));
  assert.equal(JSON.stringify(actual),JSON.stringify(['USA','GBR','IRN']));
  assert.equal(logs.length,1);assert.match(logs[0],/"count":2/);assert.match(logs[0],/ZZZ/);
  assert.equal(normalize(null).length,0);
 }
 const article={title:'T',url:'https://bbc.com/a'};
 const cached=normalizeClassified({iso3:['USA']},article);cached.iso3=['ZZZ','USA'];
 const warn=console.warn;const logs=[];console.warn=m=>logs.push(m);
 try {assert.deepEqual(splitByCache([article],{entries:{[cacheKey(article)]:{c:cached}}}).hits[0].iso3,['USA']);}
 finally {console.warn=warn;}
 assert.equal(logs.length,1);
});
