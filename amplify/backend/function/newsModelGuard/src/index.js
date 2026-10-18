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

// DeepSeek balance guard (P5). GET /user/balance; every amount is a STRING.
// Docs: https://api-docs.deepseek.com/api/get-user-balance
//   { is_available: bool, balance_infos: [{ currency: 'CNY'|'USD', total_balance, granted_balance, topped_up_balance }] }
// Alerts when the account is unavailable or USD total_balance < DEEPSEEK_BALANCE_ALERT_USD (default 3).
// Burn figure is the approximate current rate, used only for the "~N days" line in the alert.
const BALANCE_URL = 'https://api.deepseek.com/user/balance';
const BALANCE_ALERT_USD = Number(process.env.DEEPSEEK_BALANCE_ALERT_USD) || 3;
const DAILY_BURN_USD = 0.4; // measured from [usage] logs 2026-10-18 (~$0.33-0.38/day for the logged jobs)

async function checkDeepSeekBalance({ fetchImpl = fetch, publish = defaultPublish } = {}) {
  if (!DEEPSEEK_KEY) { console.warn('newsModelGuard: no DEEPSEEK_API_KEY, balance check skipped'); return null; }
  let body;
  try {
    const res = await fetchImpl(BALANCE_URL, { headers: { Authorization: `Bearer ${DEEPSEEK_KEY}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    body = await res.json();
  } catch (e) {
    console.warn(`newsModelGuard: DeepSeek balance fetch failed: ${e.message}`);
    return null;
  }
  const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
  const usd = infos.find((b) => b.currency === 'USD');
  const usdTotal = usd ? Number(usd.total_balance) : NaN;
  const unavailable = body?.is_available === false;
  const low = Number.isFinite(usdTotal) && usdTotal < BALANCE_ALERT_USD;
  console.log(JSON.stringify({ deepseekBalanceUsd: usdTotal, isAvailable: body?.is_available, threshold: BALANCE_ALERT_USD, alerting: unavailable || low }));
  if (!unavailable && !low) return { alerted: false };
  if (!unavailable && !Number.isFinite(usdTotal)) {
    console.warn('newsModelGuard: DeepSeek balance response had no usable USD total_balance');
    return null;
  }
  const amount = Number.isFinite(usdTotal) ? `$${usdTotal.toFixed(2)}` : 'unknown';
  const days = Number.isFinite(usdTotal) ? Math.floor(usdTotal / DAILY_BURN_USD) : null;
  const others = infos.filter((b) => b.currency !== 'USD')
    .map((b) => `${b.currency} total ${b.total_balance}`).join(', ') || 'none';
  const message =
    `newsModelGuard ALERT — DeepSeek balance.\n\n` +
    `USD total_balance: ${amount} (alert threshold $${BALANCE_ALERT_USD.toFixed(2)})\n` +
    `is_available: ${body?.is_available}\n` +
    `Other currencies: ${others}\n\n` +
    (days !== null ? `At ~$${DAILY_BURN_USD.toFixed(2)}/day this is ~${days} days.\n\n` : '') +
    `Checked at ${new Date().toISOString()}.`;
  const subject = `DeepSeek balance low: ${amount}${unavailable ? ' (is_available=false)' : ''}`;
  try {
    await publish({ subject, message });
  } catch (e) {
    console.warn(`newsModelGuard: DeepSeek balance SNS publish failed: ${e.message}`);
    return null;
  }
  return { alerted: true, usdTotal };
}

async function defaultPublish({ subject, message }) {
  if (!SNS_TOPIC_ARN) { console.warn('newsModelGuard: no SNS_TOPIC_ARN, balance alert not sent'); return; }
  await sns.send(new PublishCommand({ TopicArn: SNS_TOPIC_ARN, Subject: subject, Message: message }));
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

exports.checkDeepSeekBalance = checkDeepSeekBalance;

exports.handler = async () => {
  try { await checkDeepSeekBalance(); } catch (e) { console.warn(`newsModelGuard: balance check error: ${e.message}`); }
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
