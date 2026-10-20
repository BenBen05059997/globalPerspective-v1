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
