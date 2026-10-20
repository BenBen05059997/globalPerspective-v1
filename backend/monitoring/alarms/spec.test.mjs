import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const spec=JSON.parse(readFileSync(new URL('./spec.json',import.meta.url)));
test('all eight stages and a single notification topic are explicit',()=>{
 assert.deepEqual(spec.stages.map(s=>s.stage),[1,2,3,4,5,6,7,8]);
 for(const alarm of spec.alarms)assert.deepEqual(alarm.AlarmActions,[spec.notification.survivingTopicArn]);
 for(const stage of spec.stages)assert.ok(spec.alarms.some(a=>a.AlarmName===`GP-stage-${stage.stage}-failed`));
 assert.equal(new Set(spec.alarms.map(a=>a.AlarmName)).size,spec.alarms.length);
});
test('agent has marker plus native Errors; every inventoried LLM group has balance filter',()=>{
 assert.ok(spec.metricFilters.some(f=>f.logGroupName==='/aws/lambda/NewsProjectInvokeAgentLambda-dev'&&f.filterPattern.includes('[pipeline-status]')));
 assert.ok(spec.alarms.some(a=>a.MetricName==='Errors'&&a.Dimensions.some(d=>d.Value==='NewsProjectInvokeAgentLambda-dev')));
 for(const fn of spec.llmFunctions){
  assert.ok(spec.metricFilters.some(f=>f.logGroupName===fn.logGroupName&&f.filterName==='LLM-insufficient-balance'));
  for(const file of fn.sources)assert.ok(readFileSync(new URL('../../../'+file,import.meta.url)).length);
 }
});
test('no-capture dead-man includes a grace period beyond 8h and fills gaps',()=>{
 const a=spec.alarms.find(a=>a.AlarmName==='GP-selector-no-capture-9h');
 const period=a.Metrics[0].MetricStat.Period;
 assert.equal(a.EvaluationPeriods*period,9*3600);
 assert.equal(a.DatapointsToAlarm,a.EvaluationPeriods);
 assert.match(a.Metrics[1].Expression,/FILL\(captures,0\)/);
});
