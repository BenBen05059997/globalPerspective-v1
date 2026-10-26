// Read-only live-AWS helpers shared by quality/check_aws_inventory.mjs.
// list/get calls only (ap-northeast-1). Nothing here writes to AWS.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const REGION = 'ap-northeast-1';
const run = promisify(execFile);
export const aws = async (...args) => JSON.parse((await run('aws', [...args, '--region', REGION, '--output', 'json'], { maxBuffer: 16 << 20 })).stdout);
export const fnName = (arn) => (arn || '').match(/:function:([^:]+)/)?.[1] || null;

// Run fn over items n at a time (each CLI start costs seconds). Results keep the input order.
export const pool = async (items, fn, n = 8) => {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
};

// [[FunctionName, Runtime], ...] for every Lambda in the account.
export const listLambdas = () => aws('lambda', 'list-functions', '--query', 'Functions[].[FunctionName, Runtime]');

// Every EventBridge rule and Scheduler schedule in the account, with the Lambda each one targets.
//   refs      [{ via, name, lambda }]  one per (rule or schedule, target Lambda), any project
//   schedules rows for the rules/schedules that target a name in `known` (a Set): expression, tz, state, targets
//   otherRules / otherSchedules: how many rules / schedules target nothing in `known` (other projects)
export async function liveSchedules(known) {
  const rules = await aws('events', 'list-rules', '--query', 'Rules[].{Name: Name, State: State, ScheduleExpression: ScheduleExpression, EventPattern: EventPattern}');
  const ruleRows = await pool(rules, async (rule) => {
    const all = (await aws('events', 'list-targets-by-rule', '--rule', rule.Name, '--query', 'Targets[].Arn')).map(fnName).filter(Boolean);
    const targets = all.filter((t) => known.has(t));
    return { all, row: targets.length ? { via: 'EventBridge rule', name: rule.Name, expr: rule.ScheduleExpression || rule.EventPattern || '', tz: 'UTC', state: rule.State, targets } : null, ruleName: rule.Name };
  });
  const allSched = await aws('scheduler', 'list-schedules', '--query', 'Schedules[].{Name: Name, GroupName: GroupName, Arn: Target.Arn}');
  const sched = allSched.filter((s) => known.has(fnName(s.Arn)));
  const schedRows = await pool(sched, async (s) => {
    const d = await aws('scheduler', 'get-schedule', '--name', s.Name, '--group-name', s.GroupName, '--query', '{e: ScheduleExpression, tz: ScheduleExpressionTimezone, state: State}');
    return { via: 'Scheduler', name: s.Name, expr: d.e, tz: d.tz || 'UTC', state: d.state, targets: [fnName(s.Arn)] };
  });
  const refs = [
    ...ruleRows.flatMap((r) => r.all.map((lambda) => ({ via: 'EventBridge rule', name: r.ruleName, lambda }))),
    ...allSched.filter((s) => fnName(s.Arn)).map((s) => ({ via: 'Scheduler', name: s.Name, lambda: fnName(s.Arn) })),
  ];
  return {
    refs,
    schedules: [...ruleRows.map((r) => r.row).filter(Boolean), ...schedRows],
    otherRules: ruleRows.filter((r) => !r.row).length,
    otherSchedules: allSched.length - sched.length,
  };
}
