'use strict';

// Shared LLM client for the news Lambdas: one OpenAI-compatible POST /chat/completions over global fetch
// (Node >= 20), no dependencies. Every Lambda reaches it through its committed `src/_shared` symlink; the
// zip carries real files because scripts/lambda.sh stages src with the links followed.
//
// Env (legacy names, kept on purpose — see feedback_misleading_grok_naming): GROK_API_URL holds the DeepSeek
// base or full .../chat/completions URL, XAI_API_KEY the DeepSeek key. Callers pass the model they use.
//
// Every successful call prints the `[usage] {fn,step,model,...usage}` line the cost estimate
// (DEEPSEEK_COST_ESTIMATE.md) and newsModelGuard read. Transport failures (network, timeout, 429, 5xx)
// are retried with 1s·2^n backoff; 4xx never is. App-level retries (re-ask on bad output) stay in callers.

const PROVIDERS = {
  deepseek: {
    url: () => process.env.GROK_API_URL || 'https://api.deepseek.com',
    key: () => process.env.XAI_API_KEY,
    // V4 defaults to thinking mode, which burns max_tokens on invisible reasoning_content and truncates or
    // empties the answer (2026-07-26 outage). Off unless the caller asks for it.
    noThinking: { thinking: { type: 'disabled' } },
  },
  openrouter: {
    url: () => 'https://openrouter.ai/api/v1',
    key: () => process.env.OPENROUTER_API_KEY,
  },
  // OpenAI-compatible Gemini endpoint: the caller passes url + apiKey. Never also send reasoning_effort (400).
  gemini: {
    noThinking: { extra_body: { google: { thinking_config: { thinking_budget: 0 } } } },
  },
  // Any other OpenAI-compatible endpoint (e.g. Perplexity): the caller passes url + apiKey, reads `raw`.
  other: {},
};

/** Base URL or full .../chat/completions URL -> full URL. */
function completionsUrl(url) {
  if (/\/chat\/completions\/?$/.test(url)) return url;
  return `${url.replace(/\/$/, '')}/chat/completions`;
}

/** Pure: the fetch URL, headers and body for one call (exported for tests). */
function buildRequest({
  provider = 'deepseek', model, system, user, messages,
  maxTokens, temperature, topP, json = false, thinking = false, url, apiKey, extraBody,
}) {
  const p = PROVIDERS[provider];
  if (!p) throw new Error(`llm: unknown provider ${provider}`);
  const base = url || (p.url && p.url());
  if (!base) throw new Error(`llm: no url for provider ${provider}`);
  const key = apiKey !== undefined ? apiKey : p.key && p.key();
  const msgs = messages || [
    ...(system !== undefined ? [{ role: 'system', content: system }] : []),
    { role: 'user', content: user },
  ];
  const body = { model, messages: msgs };
  if (maxTokens !== undefined) body.max_tokens = maxTokens;
  if (temperature !== undefined) body.temperature = temperature;
  if (topP !== undefined) body.top_p = topP;
  if (json) body.response_format = { type: 'json_object' };
  if (!thinking && p.noThinking) Object.assign(body, p.noThinking);
  if (extraBody) Object.assign(body, extraBody);
  return {
    url: completionsUrl(base),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body,
  };
}

/** message.content as one string: array parts joined, anything else ''. Not trimmed, fences kept. */
function messageText(data) {
  const c = data?.choices?.[0]?.message?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('');
  return '';
}

function logUsage(step, model, usage) {
  console.log('[usage] ' + JSON.stringify({ fn: process.env.AWS_LAMBDA_FUNCTION_NAME, step, model, ...usage }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One chat completion.
 * opts: step (usage-log label, required), provider ('deepseek' default | 'openrouter' | 'gemini' | 'other'),
 *   model, system + user | messages, maxTokens, temperature, topP, json, thinking, url, apiKey, extraBody,
 *   timeoutMs (default 300000), retries (transport only, default 1).
 * -> { content, model, usage, finishReason, latencyMs, raw }; content is the raw message text (see messageText).
 * Throws `LLM <status>: <provider message>` on a non-2xx, `LLM timeout after <ms>ms` on timeout.
 */
async function chat(opts) {
  const { step, model, timeoutMs = 300000, retries = 1 } = opts;
  if (!step) throw new Error('llm: step is required');
  const req = buildRequest(opts);
  const init = { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) };
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    let res;
    let err;
    try {
      res = await fetch(req.url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      err = e.name === 'TimeoutError' ? new Error(`LLM timeout after ${timeoutMs}ms`) : e;
    }
    const transient = err || res.status === 429 || res.status >= 500;
    if (transient && attempt < retries) {
      console.warn(`[llm] ${step}: ${err ? err.message : `HTTP ${res.status}`}; retry ${attempt + 1}/${retries}`);
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (err) throw err;
    let text;
    try {
      text = await res.text();
    } catch (e) {
      throw e.name === 'TimeoutError' ? new Error(`LLM timeout after ${timeoutMs}ms`) : e;
    }
    let data = null;
    try { data = JSON.parse(text); } catch { /* non-JSON body */ }
    if (!res.ok) {
      const e = new Error(`LLM ${res.status}: ${data?.error?.message || text.slice(0, 300)}`);
      e.status = res.status;
      throw e;
    }
    if (!data) throw new Error(`LLM non-JSON response: ${text.slice(0, 200)}`);
    logUsage(step, model, data.usage);
    return {
      content: messageText(data),
      model: data.model || model,
      usage: data.usage,
      finishReason: data.choices?.[0]?.finish_reason,
      latencyMs: Date.now() - started,
      raw: data,
    };
  }
}

/** Drop a leading ```/```json fence and a trailing ``` fence, then trim. trailingCommas also removes `,}` / `,]`. */
function stripCodeFence(value, { trailingCommas = false } = {}) {
  if (typeof value !== 'string') return value;
  let s = value.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '');
  if (trailingCommas) s = s.replace(/,(\s*[\]}])/g, '$1');
  return s.trim();
}

/** JSON.parse of a model answer: fences stripped, empty answer -> {}. */
function parseJsonContent(content) {
  return JSON.parse(stripCodeFence(content) || '{}');
}

module.exports = { chat, buildRequest, stripCodeFence, parseJsonContent };
