import test from 'node:test';
import assert from 'node:assert/strict';
import {audit,dayRange} from './dupes.mjs';
const row=(title,threadId,extra={})=>({title,threadId,archivedAt:'2026-10-19T12:00:00Z',...extra});
test('exact title and continuation evidence across different threads, without transitive merges',()=>{
 const r=audit({'2026-10-19':[row('Same Event','a'),row('same EVENT!','b'),row('New development','c',{continues_topic:'Same Event'})]});
 assert.equal(r.pairs.length,3); assert.equal(r.pairs[0].evidence,'normalized-title');
});
test('time window and post-fix filter exclude older pairs',()=>{
 assert.equal(audit({'2026-10-01':[row('X','a')],'2026-10-19':[row('X','b')]}).pairs.length,0);
 assert.equal(audit({'2026-10-19':[row('X','a'),row('X','b')]},{since:'2026-10-19T13:00:00Z'}).pairs.length,0);
});
test('mixed thread evidence is explicitly a candidate',()=>{
 const r=audit({'2026-10-19':[row('School collapse','a'),row('Election vote','a')]});
 assert.equal(r.pairs[0].kind,'mixed-thread-candidate');
});
test('valid bounded dates required',()=>{
 assert.throws(()=>dayRange('2026-02-30','2026-03-01'));
 assert.throws(()=>dayRange('2026-10-20','2026-10-01'));
 assert.equal(dayRange('2026-10-18','2026-10-19').length,2);
});
