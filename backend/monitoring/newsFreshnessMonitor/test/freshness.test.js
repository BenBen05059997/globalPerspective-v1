'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { probe, notifyTransition } = require('../src/freshness');
const nowMs = Date.parse('2026-10-20T12:00:00Z');
function fixture() {
 let state = null, version = 0;
 const messages = [];
 const store = { read: async()=>({state:structuredClone(state),etag:version||null}), write: async(next,etag)=>{
  if ((version||null)!==etag) { const e=new Error('conflict'); e.name='PreconditionFailed';throw e; }
  state=structuredClone(next);return ++version;
 }};
 return { store, messages, publish:async(...args)=>messages.push(args), get state(){return state;} };
}
test('stale transition once, repeat quiet, recovery once, repeat healthy quiet',async()=>{
 const f=fixture();const call=health=>notifyTransition({...f,observation:{health},nowMs});
 await call('healthy');await call('stale');await call('stale');await call('failed');await call('healthy');await call('healthy');
 assert.deepEqual(f.messages.map(m=>m[0]),['[GP] Content STALE','[GP] Content RECOVERED']);
});
test('publication failure is not marked delivered; expired reservation is retried',async()=>{
 const f=fixture();await assert.rejects(notifyTransition({...f,publish:async()=>{throw new Error('SNS down');},observation:{health:'stale'},nowMs}));
 assert.equal(f.state.health,'healthy');assert.ok(f.state.pending);
 await notifyTransition({...f,observation:{health:'stale'},nowMs:nowMs+61000});
 assert.equal(f.state.health,'stale');assert.equal(f.messages.length,1);
});
test('concurrent probes reserve one transition and dryRun touches no store',async()=>{
 const f=fixture();await Promise.all([1,2].map(()=>notifyTransition({...f,observation:{health:'failed'},nowMs})));
 assert.equal(f.messages.length,1);
 await notifyTransition({store:null,publish:()=>assert.fail(),observation:{health:'stale'},dryRun:true});
});
test('probe uses nine-hour configurable limit, rejects bad/future timestamps and HTTP failures',async()=>{
 const fetchAt=asOf=>async()=>({ok:true,json:async()=>({asOf,data:{topics:[]}})});
 assert.equal((await probe({fetchImpl:fetchAt('2026-10-20T04:00:00Z'),nowMs})).health,'healthy');
 assert.equal((await probe({fetchImpl:fetchAt('2026-10-20T04:00:00Z'),nowMs,staleHours:7})).health,'stale');
 for(const asOf of [null,'bad','2026-10-21T00:00:00Z'])assert.equal((await probe({fetchImpl:fetchAt(asOf),nowMs})).health,'failed');
 assert.equal((await probe({fetchImpl:async()=>({ok:false,status:503}),nowMs})).status,503);
});
