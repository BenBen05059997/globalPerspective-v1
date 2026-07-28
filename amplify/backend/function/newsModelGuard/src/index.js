// newsModelGuard — model-retirement dead-man's-switch (built 2026-07-28).
//
// The 2026-07-24 `deepseek-chat` retirement became a 36h silent outage because
// nothing was watching the deadline (BACKEND_DEEPSEEK_V4_MIGRATION_PLAN.md lesson).
// This is the passive guard against a repeat: daily it scans EVERY Lambda's env for
// DeepSeek model IDs and SNS-alerts if any is (a) a deprecated alias slated for
// retirement, or (b) absent from DeepSeek's live /models list (already retired/invalid).
//
// Roll-your-own, no paid infra; mirrors newsFreshnessMonitor / newsErrorDigest.
// Alerts route to SNS GlobalPerspectiveAlerts. Honest-empty: silent when all clear.
// No bundled deps — @aws-sdk/* v3 + fetch are in the Node 20 runtime.

const { LambdaClient, ListFunctionsCommand } = require('@aws-sdk/client-lambda');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const lambda = new LambdaClient({ region: REGION });
const sns = new SNSClient({ region: REGION });

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const MODELS_URL = process.env.DEEPSEEK_MODELS_URL || 'https://api.deepseek.com/models';
// env var NAMES that hold a model id anywhere in the fleet
const MODEL_VARS = (process.env.MODEL_VARS || 'GROK_MODEL,LLM_MODEL,MODEL,AUDIT_MODEL,JUDGE_MODEL,PPLX_MODEL,AI_MODEL')
  .split(',').map((s) => s.trim()).filter(Boolean);
// aliases that still resolve today but are deprecated / at risk of being pulled
const DEPRECATED = (process.env.DEPRECATED_ALIASES || 'deepseek-chat,deepseek-reasoner')
  .split(',').map((s) => s.trim()).filter(Boolean);
// functions to skip: explicit names + anything ending in -sandbox (throwaway test envs,
// legitimately frozen on old configs — flagging them daily is noise, not signal)
const IGNORE = (process.env.IGNORE_FUNCTIONS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
function ignored(name) {
  return name.endsWith('-sandbox') || IGNORE.includes(name);
}

// a DIRECT DeepSeek model id — NOT OpenRouter's namespaced "deepseek/..." form (different lifecycle)
function isDeepSeekId(v) {
  return typeof v === 'string' && /^deepseek-/.test(v);
}

async function liveDeepSeekModels() {
  if (!DEEPSEEK_KEY) return null; // can't verify the /models list → skip the "missing" check
  const res = await fetch(MODELS_URL, { headers: { Authorization: `Bearer ${DEEPSEEK_KEY}` } });
  if (!res.ok) throw new Error(`deepseek /models ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j?.data || []).map((m) => m.id);
}

async function listAllFunctions() {
  const out = [];
  let marker;
  do {
    const r = await lambda.send(new ListFunctionsCommand({ Marker: marker, MaxItems: 50 }));
    out.push(...(r.Functions || []));
    marker = r.NextMarker;
  } while (marker);
  return out;
}

exports.handler = async () => {
  let live = null;
  let liveErr = null;
  try { live = await liveDeepSeekModels(); } catch (e) { liveErr = e.message; }

  const fns = await listAllFunctions();
  const findings = [];
  for (const f of fns) {
    if (ignored(f.FunctionName)) continue;
    const env = f.Environment?.Variables || {};
    for (const name of MODEL_VARS) {
      const val = env[name];
      if (!isDeepSeekId(val)) continue;
      const deprecated = DEPRECATED.includes(val);
      const missing = live ? !live.includes(val) : false;
      if (deprecated || missing) {
        findings.push({
          fn: f.FunctionName,
          envVar: name,
          value: val,
          reason: missing ? 'NOT in live /models (retired/invalid)' : 'deprecated alias — migrate before retirement',
        });
      }
    }
  }

  const summary = { checkedFunctions: fns.length, liveModels: live, liveErr, findingsCount: findings.length, findings };
  console.log(JSON.stringify(summary));

  if (findings.length && SNS_TOPIC_ARN) {
    const lines = findings.map((x) => `• ${x.fn} [${x.envVar}=${x.value}] — ${x.reason}`).join('\n');
    const body =
      `newsModelGuard ALERT — ${findings.length} Lambda(s) on a deprecated/retired DeepSeek model.\n\n` +
      `${lines}\n\n` +
      `Live DeepSeek models: ${live ? live.join(', ') : `(UNVERIFIED — ${liveErr || 'no key'})`}\n\n` +
      `Fix (proven recipe, BACKEND_DEEPSEEK_V4_MIGRATION_PLAN.md): patch thinking:{type:'disabled'} into ` +
      `the DeepSeek request body if not already present, then flip the env var to a live model id ` +
      `(deepseek-v4-flash or deepseek-v4-pro). Deploy code BEFORE the env flip.\n\n` +
      `Checked ${fns.length} functions in ${REGION} at ${new Date().toISOString()}.`;
    await sns.send(new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: `[GP] Model-retirement guard: ${findings.length} Lambda(s) on deprecated DeepSeek model`,
      Message: body,
    }));
  }
  return summary;
};
