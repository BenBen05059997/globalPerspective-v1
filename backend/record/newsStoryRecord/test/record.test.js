'use strict';

const {
  test
} = require('node:test');
const assert = require('node:assert/strict');
const {
  makeHandler
} = require('../src/index');
const {
  makeS3Json
} = require('../src/_shared/s3json');
const {
  transition,
  duplicates
} = require('../src/rules');
const {makeStore}=require('../src/store');
const {fixtureStore}=require('./fixture-store');
const etag=body=>require('node:crypto').createHash('sha256').update(body).digest('hex');
const date = '2026-10-19';
const entry = (id = 'a', d = date) => ({
  threadId: id,
  topicId: `t-${id}-${d}`,
  title: 'Headline',
  date: d,
  archivedAt: `${d}T04:00:00Z`,
  actors: ['An Actor'],
  iso3: ['FRA'],
  sources: [{
    source: 'reuters.com',
    title: 'Shared outlet headline',
    url: 'https://reuters.com/a'
  }]
});
const pred = (id = 'a') => ({
  PK: `PRED#t-${id}-${date}`,
  SK: date,
  threadId: id,
  topicId: `t-${id}-${date}`,
  scenarios: [{
    label: 'Scenario',
    triggers: [{
      id: '0-0',
      text: 'An event occurs',
      p: 70,
      resolutionSource: 'Reuters',
      deadline: '2026-10-18',
      qid: 'q1'
    }]
  }]
});
const data = () => ({
  entries: [entry()],
  predictions: [pred()],
  analyses: {
    a: {
      riskScore: 50
    }
  },
  drifts: {
    a: {
      whyChanged: 'Expected path changed'
    }
  },
  coverage: {
    missingDays: []
  }
});
function setup(input = data(), llm = null) {
  const objects = new Map(),
    writes = [];
  class Get {
    constructor(input) {
      this.input = input;
    }
  }
  class Put {
    constructor(input) {
      this.input = input;
    }
  }
  const client = {
    async send(c) {
      const i = c.input;
      if (c instanceof Get) {
        if (!objects.has(i.Key)) throw Object.assign(Error(), {
          name: 'NoSuchKey'
        });
        return {
          ETag: etag(objects.get(i.Key)),
          Body: {
            transformToString: async () => objects.get(i.Key)
          }
        };
      }
      writes.push(i);
      if (i.IfNoneMatch && objects.has(i.Key)) throw Object.assign(Error(), {
        name: 'PreconditionFailed'
      });
      if(i.IfMatch && i.IfMatch!==etag(objects.get(i.Key)||''))throw Object.assign(Error(),{name:'PreconditionFailed'});
      objects.set(i.Key, i.Body);
      return {};
    }
  };
  const s3json = makeS3Json({
    client,
    GetObjectCommand: Get,
    PutObjectCommand: Put,
    bucket: 'fake'
  });
  return {
    objects,
    writes,
    s3json,
    run: makeHandler({
      store: fixtureStore(input),
      s3json,
      llm,
      now: () => `${date}T05:45:00Z`
    }),
    get: k => JSON.parse(objects.get(k)),
    input
  };
}
const judgment = extra => ({
  label: 'JUDGMENT',
  confidence: 0.8,
  ...extra
});
const evidence = [{
  archive: `archive#${date}`,
  topicId: `t-a-${date}`,
  url: 'https://reuters.com/a'
}];
test('no LLM deterministic birth, forks, late, index; shadow prefix; idempotent snapshot and dated line', async () => {
  const s = setup();
  const r = await s.run({
    date,
    shadow: true
  });
  assert.equal(r.birthsFound, 1);
  assert.equal(r.lateBranches, 1);
  assert.deepEqual(r.llmCalls, {
    chapter: 1,
    trigger: 1,
    line: 1,
    total: 3
  });
  assert.ok(r.skipped.every(x => x.reason === 'not run: no llm'));
  const key = `record/shadow/stories/a/${date}.json`;
  const before = s.objects.get(key);
  await s.run({
    date,
    shadow: true
  });
  assert.equal(s.objects.get(key), before);
  assert.ok([...s.objects.keys()].every(k => k.startsWith('record/shadow/')));
  assert.equal(s.writes.filter(w => w.Key === key).length, 1);
  assert.ok(s.writes.find(w => w.Key === key).IfNoneMatch === '*');
});
test('LLM prompts blind to p; chapter put-once; line versioned weekly', async () => {
  const tasks = [];
  const s = setup(data(), async p => {
    tasks.push(p);
    assert.ok(!JSON.stringify(p).includes('"p":'));
    return judgment(p.task === 'chapter' ? {
      name: 'Shift',
      text: 'A new chapter.'
    } : p.task === 'line' ? {
      text: 'Current line.'
    } : {
      status: 'hold'
    });
  });
  await s.run({
    date
  });
  await s.run({
    date
  });
  let r = s.get('record/stories/a/latest.json');
  assert.equal(r.chapters.length, 1);
  assert.equal(r.line.text, 'Current line.');
  s.input.entries.push(entry('a', '2026-10-20'));
  await s.run({
    date: '2026-10-20'
  });
  r = s.get('record/stories/a/latest.json');
  assert.equal(r.chapters.length, 1);
  assert.equal(tasks.filter(p => p.task === 'line').length, 1);
  assert.ok(!('chapters' in tasks.find(p => p.task === 'chapter').context));
  await s.run({
    date: '2026-10-26'
  });
  assert.equal(s.get('record/stories/a/latest.json').line.versions[0].writtenAt, date);
});
test('fired requires named-source citation or two outlets, fabricated references rejected', () => {
  const b = {
    status: [],
    resolutionSource: 'Reuters'
  };
  const entries = [{
    archive: `archive#${date}`,
    topicId: `t-a-${date}`,
    outlets: entry().sources
  }];
  assert.equal(transition(b, {
    status: 'fired',
    evidence
  }, entries, false).status, 'fired');
  assert.equal(transition({
    ...b,
    resolutionSource: 'Official Gazette'
  }, {
    status: 'fired',
    evidence
  }, entries, false).status, 'hold');
  assert.equal(transition(b, {
    status: 'fired',
    evidence: [{
      ...evidence[0],
      url: 'https://fake'
    }]
  }, entries, false).status, 'hold');
  const extra = {
    archive: 'archive#x',
    topicId: 'other',
    outlets: [{
      source: 'apnews.com',
      url: 'https://apnews.com/b'
    }]
  };
  assert.equal(transition({
    ...b,
    resolutionSource: 'Official Gazette'
  }, {
    status: 'fired',
    evidence: [...evidence, {
      archive: 'archive#x',
      topicId: 'other',
      url: 'https://apnews.com/b'
    }]
  }, [...entries, extra], false).status, 'fired');
});
test('dead only for sibling fire or cited impossibility', () => {
  const b = {
    status: [],
    resolutionSource: 'Reuters'
  };
  const entries = [{
    archive: `archive#${date}`,
    topicId: `t-a-${date}`,
    outlets: entry().sources
  }];
  assert.equal(transition(b, {
    status: 'dead'
  }, entries, false).status, 'hold');
  assert.equal(transition(b, {
    status: 'dead'
  }, entries, true).status, 'dead');
  assert.equal(transition(b, {
    status: 'dead',
    impossible: true,
    evidence
  }, entries, false).status, 'dead');
});
test('dead resurrection appends status and correction; verdict revisions are mirrored', async () => {
  const d = data();
  d.verdicts = [{
    PK: 'Q#q1',
    SK: 'VERDICT',
    verdict: 'no',
    decidedAt: date
  }, {
    PK: 'Q#q1',
    SK: 'VERDICT#2',
    verdict: 'yes',
    decidedAt: '2026-10-20'
  }];
  const s = setup(d, async p => judgment(p.task === 'trigger' ? {
    status: 'dead',
    impossible: true,
    evidence,
    note: 'Trigger impossible'
  } : p.task === 'chapter' ? {
    name: 'One',
    text: 'Chapter.'
  } : {
    text: 'Line.'
  }));
  await s.run({
    date
  });
  const before = s.get(`record/stories/a/${date}.json`);
  assert.equal(before.forks[0].branches[0].scored.verdict, 'no');
  d.entries.push(entry('a', '2026-10-20'));
  const run = makeHandler({
    store: fixtureStore(d),
    s3json: s.s3json,
    llm: async p => judgment(p.task === 'trigger' ? {
      status: 'fired',
      evidence: [{
        archive: 'archive#2026-10-20',
        topicId: 't-a-2026-10-20',
        url: 'https://reuters.com/a'
      }],
      note: 'Trigger observed'
    } : {
      text: 'Line.'
    }),
    now: () => date
  });
  await run({
    date: '2026-10-20'
  });
  const b = s.get('record/stories/a/latest.json').forks[0].branches[0];
  assert.deepEqual(b.status.map(s => s.status), ['dead', 'resurrected']);
  assert.equal(b.scored.verdict, 'yes');
  assert.equal(b.verdicts.length, 2);
  assert.equal(s.get('record/corrections/2026-10-20.json').corrections[0].kind, 'resurrected');
  assert.deepEqual(s.get(`record/stories/a/${date}.json`), before);
});
test('create-only conflict accepts the same authoritative timeline winner', async () => {
  const s = setup();
  const original = s.s3json.putOnce;
  s.s3json.putOnce = async (k, r) => {
    if (k.includes('/stories/')) {
      await original(k,r);
      return false;
    }
    return original(k, r);
  };
  await s.run({
    date
  });
  assert.deepEqual(s.get('record/stories/a/latest.json'),s.get(`record/stories/a/${date}.json`));
  assert.equal(s.get('record/index.json').stories[0].line,s.get('record/stories/a/latest.json').line.text);
});
test('duplicate detection reports evidence and does not drop either record', async () => {
  const d = data();
  d.entries.push(entry('b'));
  const s = setup(d);
  const r = await s.run({
    date
  });
  assert.equal(r.proposedMerges.length, 1);
  assert.deepEqual(r.proposedMerges[0].evidence.places, ['FRA']);
  assert.equal(s.get('record/index.json').stories.length, 2);
  const stories = ['a', 'b'].map(threadId => ({
    ...s.get(`record/stories/${threadId}/latest.json`),
    born: '2026-10-15',
    bornAt: '2026-10-15T00:00:00Z'
  }));
  assert.equal(duplicates(stories, date).length, 0);
});
test('failure before publishing pointers leaves previous latest; retry recovers snapshots', async () => {
  const d = data();
  d.entries.push(entry('b'));
  const s = setup(d);
  const put = s.s3json.putOnce;
  s.s3json.putOnce = async (k, r) => {
    if (k.includes('/b/')) throw Error('simulated');
    return put(k, r);
  };
  await assert.rejects(s.run({
    date
  }), /simulated/);
  assert.equal(s.objects.has('record/stories/a/latest.json'), false);
  s.s3json.putOnce = put;
  await s.run({
    date
  });
  assert.ok(s.objects.has('record/stories/a/latest.json'));
});
test('historical replays refuse to rewind pointers', async () => {
  const s = setup();
  await s.run({
    date: '2026-10-20'
  });
  await assert.rejects(s.run({
    date
  }), /rewind/);
});
test('line contradiction correction requires valid citation and preserves dated old text', async () => {
  const s = setup(data(), async p => judgment(p.task === 'line' ? {
    text: 'Initial line'
  } : p.task === 'chapter' ? {
    name: 'Chapter',
    text: 'Chapter'
  } : {
    status: 'hold'
  }));
  await s.run({
    date
  });
  const d = '2026-10-26';
  s.input.entries.push(entry('a', d));
  const run = makeHandler({
    store: fixtureStore(s.input),
    s3json: s.s3json,
    llm: async p => judgment(p.task === 'trigger' ? {status:'hold'} : {
      text: 'Revised line',
      contradicted: true,
      reason: 'New facts',
      evidence: [{
        archive: `archive#${d}`,
        topicId: `t-a-${d}`,
        url: 'https://reuters.com/a'
      }]
    })
  });
  await run({
    date: d
  });
  assert.equal(s.get(`record/stories/a/${date}.json`).line.text, 'Initial line');
  assert.equal(s.get('record/stories/a/latest.json').line.versions[0].text, 'Initial line');
  assert.equal(s.get(`record/corrections/${d}.json`).corrections[0].kind, 'line-contradicted');
});
test('read store uses as-of histories and retains coverage gaps',async()=>{
 const d=data();d.analyses.a={generatedAt:'2026-10-20T04:40:00Z',riskScore:99};
 d.summaryRows=[{PK:'THREAD#a',SK:`THREAD_HISTORY#${date}`,riskScore:20}];
 const result=await fixtureStore(d).load(date);
 assert.equal(result.analyses.a.riskScore,20);assert.equal(result.entries.length,1);
 assert.ok(result.coverage.missingDays.includes('2026-10-14'));
});
test('named source matching uses boundaries and recognises named AP publisher', () => {
  const {
    namedSourceMatches
  } = require('../src/rules');
  assert.equal(namedSourceMatches('Reuters or AP wire report', 'apnews.com'), true);
  assert.equal(namedSourceMatches('Corporate registry', 'apnews.com'), false);
  assert.equal(namedSourceMatches('Reuters report', 'reuters.com'), true);
  assert.equal(namedSourceMatches('Reuters report', 'uters.com'), false);
});
test('two names for the same outlet do not satisfy two-outlet firing rule', () => {
  const entries = [{
    archive: 'archive#a',
    topicId: 'a',
    outlets: [{
      source: 'Reuters',
      url: 'https://reuters.com/a'
    }]
  }, {
    archive: 'archive#b',
    topicId: 'b',
    outlets: [{
      source: 'reuters.com',
      url: 'https://reuters.com/b'
    }]
  }];
  const evidence = entries.map(e => ({
    archive: e.archive,
    topicId: e.topicId,
    url: e.outlets[0].url
  }));
  assert.equal(transition({
    status: [],
    resolutionSource: 'Official Gazette'
  }, {
    status: 'fired',
    evidence
  }, entries, false).status, 'hold');
});
test('late branch can fire on later evidence and birth stays put once', async () => {
  const s = setup();
  await s.run({date});
  const next = '2026-10-20';
  s.input.entries.push(entry('a', next), entry('a', '2026-09-01'));
  const run = makeHandler({store:fixtureStore(s.input),s3json:s.s3json,
    llm:async p=>judgment(p.task==='trigger'?{status:'fired',evidence:[{archive:`archive#${next}`,topicId:`t-a-${next}`,url:'https://reuters.com/a'}]}:p.task==='chapter'?{name:'New chapter',text:'Grounded chapter.'}:{text:'Grounded line.'})});
  await run({date:next});
  const record=s.get('record/stories/a/latest.json');
  assert.equal(record.born,date);
  assert.deepEqual(record.forks[0].branches[0].status.map(s=>s.status),['late','fired']);
});
test('duplicate reports require an actor, a place and an identical outlet headline',()=>{
  const base={threadId:'a',born:date,bornAt:`${date}T04:00:00Z`,actors:['Actor'],countries:['FRA'],events:[{outlets:entry().sources}]};
  const other={...base,threadId:'b'};
  assert.equal(duplicates([base,{...other,actors:[]}],date).length,0);
  assert.equal(duplicates([base,{...other,countries:['DEU']}],date).length,0);
  assert.equal(duplicates([base,{...other,events:[{outlets:[{...entry().sources[0],title:'Different headline'}]}]}],date).length,0);
});
test('malformed model judgment is isolated before that story latest pointer moves',async()=>{
  const s=setup(data(),async()=>({label:'JUDGMENT',confidence:0.9,name:'Missing text'}));
  const report=await s.run({date});assert.match(report.failures[0].error,/invalid chapter text/);
  assert.equal([...s.objects.keys()].some(k=>k.endsWith('latest.json')),false);
});

test('missing run-date archive is explicitly stale in index',async()=>{
 const d=data();d.entries=[entry('a','2026-10-18')];d.coverage.missingDays=[date];const s=setup(d);await s.run({date});
 assert.equal(s.get('record/index.json').stale,true);
});

test('duplicate 48-hour cutoff uses the injected run time, not a later day boundary',()=>{
 const base={threadId:'a',born:'2026-10-16',bornAt:'2026-10-16T00:00:00Z',actors:['Actor'],countries:['CAN'],events:[{outlets:entry().sources}]};
 const other={...base,threadId:'b',born:'2026-10-17',bornAt:'2026-10-17T12:00:00Z'};
 assert.equal(duplicates([base,other],date,`${date}T05:45:00Z`).length,1);
 assert.equal(duplicates([base,other],date,`${date}T13:00:00Z`).length,0);
});

test('duplicate proposal prefers the earlier actual birth within the same date',()=>{
 const base={threadId:'z',born:date,bornAt:`${date}T04:00:00Z`,actors:['Actor'],countries:['CAN'],events:[{outlets:entry().sources}]};
 const other={...base,threadId:'a',bornAt:`${date}T12:00:00Z`};
 const [proposal]=duplicates([base,other],date,`${date}T13:00:00Z`);
 assert.equal(proposal.from,'a');assert.equal(proposal.into,'z');
});

test('one model failure retains raw facts and allows another story to complete',async()=>{
 const d=data();d.entries.push(entry('b'));
 const s=setup(d,async p=>{if(p.context.threadId==='a')throw Error('simulated outage');return judgment({text:'B line'});});
 const report=await s.run({date});assert.deepEqual(report.failures.map(f=>f.threadId),['a']);
 assert.equal(s.objects.has('record/stories/a/latest.json'),false);
 assert.equal(s.get('record/stories/b/latest.json').line.text,'B line');
 const events=s.objects.get(`record/timeline/${date}.jsonl`).trim().split('\n').map(JSON.parse);
 assert.ok(events.some(e=>e.threadId==='a'&&e.kind==='entry'));
 assert.equal(s.get('record/index.json').stale,true);
});
test('actual stored story, index and corrections rebuild exactly from timeline; views can be deleted',async()=>{
 const s=setup();await s.run({date});const {makeTimeline,indexView}=require('../src/persistence');
 const t=makeTimeline(s.s3json,'record/');await t.load(date);
 const dated=s.get(`record/stories/a/${date}.json`);
 assert.deepEqual(t.view('a',date),dated);assert.deepEqual(indexView(t.days,date),s.get('record/index.json'));
 const {validate}=require('./schema.test');assert.equal(validate(dated),true,JSON.stringify(validate.errors));
 assert.equal(validate(s.get('record/index.json')),true,JSON.stringify(validate.errors));
 const beforeTimeline=Object.fromEntries([...s.objects].filter(([k])=>k.endsWith('.jsonl')));
 for(const key of [...s.objects.keys()])if(!key.includes('/timeline/'))s.objects.delete(key);
 const report=await s.run({date});assert.equal(report.llmCalls.total,0);
 assert.deepEqual(s.get(`record/stories/a/${date}.json`),dated);
 assert.deepEqual(Object.fromEntries([...s.objects].filter(([k])=>k.endsWith('.jsonl'))),beforeTimeline);
});
test('object-valued analysis actors contribute names and cannot create a false shared actor',async()=>{
 const d=data();d.entries=[{...entry('a'),actors:[]},{...entry('b'),actors:[]}];
 d.analyses={a:{riskScore:50,keyActors:[{name:'Actor A',role:'leader',mentionCount:2}]},b:{riskScore:50,keyActors:[{name:'Actor B',role:'leader',mentionCount:2}]}};
 const s=setup(d);const report=await s.run({date});assert.equal(report.proposedMerges.length,0);
 assert.deepEqual(s.get('record/stories/a/latest.json').actors,['Actor A']);
});
