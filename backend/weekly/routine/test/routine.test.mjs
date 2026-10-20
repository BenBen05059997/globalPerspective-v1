import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=fileURLToPath(new URL('../',import.meta.url));
const root=path.resolve(dir,'../../..');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const routine=read(path.join(dir,'routine.json'));
const policy=read(path.join(dir,'iam-policy.json'));
const bucket='arn:aws:s3:::globalperspective-world-280362093938';
const tables=['NewsCache','SummarizeAndPredict','GlobalPerspectivePredictionLog'].map(n=>`arn:aws:dynamodb:ap-northeast-1:280362093938:table/${n}`);
const sorted=a=>[...a].sort();
test('routine has the complete pinned definition and Sunday UTC schedule',()=>{
  assert.deepEqual(sorted(Object.keys(routine)),sorted(['name','cron','repo','branch','model','environment','prompt']));
  assert.equal(routine.name,'analyst-weekly');
  assert.equal(routine.cron,'0 6 * * 0');
  assert.equal(routine.repo,'BenBen05059997/globalPerspective-v1');
  assert.equal(routine.branch,'main');
  assert.equal(routine.model,'claude-sonnet-4-6');
  assert.deepEqual(routine.environment,{secrets:['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_REGION']});
  assert.ok(routine.prompt.length>500);
});
test('every prompt script and procedure path exists; commands match weekly CLI',()=>{
  const scripts=[...new Set(routine.prompt.match(/backend\/[A-Za-z0-9_./-]+\.(?:mjs|js)\b/g))];
  assert.deepEqual(sorted(scripts),sorted(['backend/weekly/pull.mjs','backend/weekly/check.mjs','backend/weekly/publish.mjs','backend/weekly/sections.js']));
  for(const p of [...scripts,'.claude/skills/weekly-brief/SKILL.md','backend/weekly/schema/weekly.schema.json'])assert.ok(statSync(path.join(root,p)).isFile(),p);
  assert.ok(routine.prompt.includes('node backend/weekly/pull.mjs --week-ending "$WEEK" --out "$INPUTS"'));
  assert.ok(routine.prompt.includes('node backend/weekly/check.mjs "$DRAFT" --inputs "$INPUTS"'));
  assert.ok(routine.prompt.includes('node backend/weekly/publish.mjs "$DRAFT"'));
});
test('prompt gates publication and forbids delivery and code mutation',()=>{
  for(const text of ['current UTC Sunday','otherwise stop without publishing','If this check fails, stop immediately, publish nothing','Never send email','Never edit, commit or push code','separately authorized publication step','actual S3 keys written'])assert.ok(routine.prompt.includes(text),text);
});
test('policy exactly matches approved coordinator artifact',()=>{
  assert.deepEqual(policy,read(new URL('./approved-iam-policy.json',import.meta.url)));
  if(process.env.WEEKLY_LIVE_POLICY)assert.deepEqual(policy,read(process.env.WEEKLY_LIVE_POLICY));
});
test('policy has only the four scoped grants and no wildcard actions or other resources',()=>{
  assert.equal(policy.Version,'2012-10-17');assert.equal(policy.Statement.length,4);
  const expected={ReadTables:{actions:['dynamodb:GetItem','dynamodb:BatchGetItem','dynamodb:Query','dynamodb:Scan'],resources:tables},ReadWebAndWeekly:{actions:['s3:GetObject'],resources:[`${bucket}/web/*`,`${bucket}/weekly/*`]},WriteWeeklyOnly:{actions:['s3:PutObject'],resources:[`${bucket}/weekly/*`]},ListScoped:{actions:['s3:ListBucket'],resources:[bucket]}};
  assert.deepEqual(sorted(policy.Statement.map(s=>s.Sid)),sorted(Object.keys(expected)));
  for(const s of policy.Statement){
    const e=expected[s.Sid];assert.equal(s.Effect,'Allow');
    assert.deepEqual(sorted(Object.keys(s)),sorted(s.Sid==='ListScoped'?['Sid','Effect','Action','Resource','Condition']:['Sid','Effect','Action','Resource']));
    assert.deepEqual(sorted(s.Action),sorted(e.actions));assert.deepEqual(sorted(s.Resource),sorted(e.resources));
    for(const a of s.Action){assert.ok(!a.includes('*'));if(!['dynamodb:GetItem','dynamodb:BatchGetItem','dynamodb:Query','dynamodb:Scan','s3:GetObject','s3:ListBucket'].includes(a)){
      assert.equal(a,'s3:PutObject');assert.deepEqual(s.Resource,[`${bucket}/weekly/*`]);
    }}
  }
  assert.deepEqual(policy.Statement.find(s=>s.Sid==='ListScoped').Condition,{StringLike:{'s3:prefix':['web/*','weekly/*']}});
});
