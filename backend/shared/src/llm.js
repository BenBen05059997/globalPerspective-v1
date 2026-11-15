'use strict';

// Shared LLM client for the news Lambdas over global fetch (Node >= 20), no dependencies. Two wire formats:
// OpenAI-style POST /chat/completions (deepseek, openrouter, gemini, other) and Anthropic's native
// POST /v1/messages (anthropic, called directly, no SDK: decision 0059). Every Lambda reaches it through its
// committed `src/_shared` symlink; the zip carries real files because scripts/lambda.sh stages src with the links followed.
//
// Provider per call: a model value may carry a known-provider prefix, `anthropic:claude-haiku-5-5`; the prefix
// picks the provider and is stripped before the request and in the usage log. A bare model keeps today's
// behaviour (provider = the caller's `provider`, default deepseek). So a job's provider is one env value.
//
// Env (legacy names, kept on purpose — see feedback_misleading_grok_naming): GROK_API_URL holds the DeepSeek
// base or full .../chat/completions URL, XAI_API_KEY the DeepSeek key; ANTHROPIC_API_KEY the Anthropic key.
// Each provider reads only its own key, so a DeepSeek key is never sent to Anthropic or the reverse.
// Callers pass the model they use.
//
// Every successful call prints the `[usage] {fn,step,model,...usage}` line the cost estimate
// and newsModelGuard read. Transport failures (network, timeout, 429, 5xx)
// are retried with 1s·2^n backoff; 4xx never is. App-level retries (re-ask on bad output) stay in callers.

const PROVIDERS = {
  deepseek: {
    url: () => process.env.GROK_API_URL || 'https://api.deepseek.com',
    key: () => process.env.XAI_API_KEY,
    // V4 defaults to thinking mode, which burns max_tokens on invisible reasoning_content and truncates or
    // empties the answer (2026-07-26 outage). Off unless the caller asks for it.
    noThinking: { thinking: { type: 'disabled' } },
  },
  // Anthropic Messages API, native format. max_tokens is required there, so a call without maxTokens gets 4096.
  anthropic: {
    format: 'anthropic',
    url: () => 'https://api.anthropic.com/v1/messages',
    key: () => process.env.ANTHROPIC_API_KEY,
    version: '2026-10-21',
    defaultMaxTokens: 4096,
    // Haiku and Sonnet 5.5 think by default and bill that as output inside max_tokens (the DeepSeek 2026-07-26
    // failure again). Off unless the caller asks. Sonnet 5.5 answers 400 to `disabled`; its lowest setting is
    // `between_tools`. Temperature, top_p and top_k are never sent: the 5.5 models answer 400 to non-default values.
    noThinking: (model) => ({ thinking: { type: /^claude-sonnet-5-5/.test(model) ? 'between_tools' : 'disabled' } }),
    // No schema-less JSON mode: ask in the system text.
    jsonSystem: 'Reply with a single JSON value only: no code fences and no commentary before or after it.',
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

/** `anthropic:claude-haiku-5-5` -> {provider:'anthropic', model:'claude-haiku-5-5'}. Only a known provider name counts as a
 * prefix (so `x/y:free` stays a model name); a bare model keeps the caller's provider (default deepseek). */
function resolveProvider({ provider = 'deepseek', model }) {
  const m = typeof model === 'string' ? /^([a-z]+):(.+)$/.exec(model) : null;
  return m && PROVIDERS[m[1]] ? { provider: m[1], model: m[2] } : { provider, model };
}

/** Pure: the fetch URL, headers and body for one call (exported for tests). Also returns the resolved provider and model. */
function buildRequest(opts) {
  const {
    system, user, messages, maxTokens, temperature, topP, json = false, thinking = false, url, apiKey, extraBody,
  } = opts;
  const { provider, model } = resolveProvider(opts);
  const p = PROVIDERS[provider];
  if (!p) throw new Error(`llm: unknown provider ${provider}`);
  const key = apiKey !== undefined ? apiKey : p.key && p.key();
  if (p.format === 'anthropic') {
    if (!key) throw new Error('llm: ANTHROPIC_API_KEY is not set');
    const msgs = messages || [{ role: 'user', content: user }];
    const sys = [
      ...(messages ? [] : [system]),
      ...msgs.filter((m) => m.role === 'system').map((m) => m.content),
      ...(json ? [p.jsonSystem] : []),
    ].filter((x) => x !== undefined && x !== '').join('\n\n');
    const body = { model, max_tokens: maxTokens !== undefined ? maxTokens : p.defaultMaxTokens };
    if (sys) body.system = sys;
    body.messages = msgs.filter((m) => m.role !== 'system');
    if (!thinking) Object.assign(body, p.noThinking(model));
    if (extraBody) Object.assign(body, extraBody);
    // temperature and topP are accepted and ignored (see PROVIDERS.anthropic). `url` is ignored: the endpoint is fixed.
    return {
      provider,
      model,
      url: p.url(),
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': p.version },
      body,
    };
  }
  const base = url || (p.url && p.url());
  if (!base) throw new Error(`llm: no url for provider ${provider}`);
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
    provider,
    model,
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

/** An OpenAI-style response -> { content, usage, finishReason }. */
function readOpenAi(data) {
  return { content: messageText(data), usage: data.usage, finishReason: data.choices?.[0]?.finish_reason };
}

const ANTHROPIC_FINISH = { end_turn: 'stop', stop_sequence: 'stop', max_tokens: 'length' };

/**
 * An Anthropic Messages response -> { content, usage, finishReason } in the OpenAI-style shape callers know:
 * the text blocks joined; usage as prompt_tokens (input incl. cache) / completion_tokens / prompt_cache_hit_tokens, the
 * names the [usage] readers (newsHealth) use; stop_reason end_turn -> 'stop', max_tokens -> 'length'.
 * stop_reason 'refusal' is HTTP 200 with no usable content: throws. With json, prose around the JSON is cut off
 * (the one place that does it); a cut-off (truncated) answer is returned as is for the caller's salvage.
 */
function readAnthropic(data, json) {
  if (data.stop_reason === 'refusal') {
    const cat = data.stop_details?.category;
    const e = new Error(`LLM refusal${cat ? ` (${cat})` : ''}: the model declined this request`);
    e.stopReason = 'refusal';
    throw e;
  }
  const text = (Array.isArray(data.content) ? data.content : []).filter((b) => b?.type === 'text').map((b) => b.text || '').join('');
  const u = data.usage;
  const usage = u && {
    prompt_tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
    completion_tokens: u.output_tokens || 0,
    ...(u.cache_read_input_tokens !== undefined ? { prompt_cache_hit_tokens: u.cache_read_input_tokens } : {}),
  };
  return { content: json ? jsonOnly(text) : text, usage, finishReason: ANTHROPIC_FINISH[data.stop_reason] || data.stop_reason };
}

/** The JSON part of an answer: the text itself when it parses (fences allowed), else the first {..} / [..] span that parses, else the text. */
function jsonOnly(text) {
  const s = stripCodeFence(text);
  try { JSON.parse(s); return text; } catch { /* look for a span */ }
  const i = s.search(/[{[]/);
  const j = i < 0 ? -1 : s.lastIndexOf(s[i] === '{' ? '}' : ']');
  if (j > i) {
    const span = s.slice(i, j + 1);
    try { JSON.parse(span); return span; } catch { /* not JSON */ }
  }
  return text;
}

function logUsage(step, model, usage) {
  console.log('[usage] ' + JSON.stringify({ fn: process.env.AWS_LAMBDA_FUNCTION_NAME, step, model, ...usage }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One chat completion.
 * opts: step (usage-log label, required), provider ('deepseek' default | 'anthropic' | 'openrouter' | 'gemini' | 'other'; a
 *   known-provider prefix on `model` overrides it), model, system + user | messages, maxTokens, temperature, topP (ignored by
 *   anthropic), json, thinking, url, apiKey, extraBody, timeoutMs (default 300000), retries (transport only, default 1).
 * -> { content, model, usage, finishReason, latencyMs, raw }; content is the raw message text (see messageText).
 * Throws `LLM <status>: <provider message>` on a non-2xx, `LLM timeout after <ms>ms` on timeout, `LLM refusal` on an Anthropic refusal.
 */
async function chat(opts) {
  const { step, timeoutMs = 300000, retries = 1 } = opts;
  if (!step) throw new Error('llm: step is required');
  const req = buildRequest(opts);
  const { provider, model } = req;
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
    const out = PROVIDERS[provider].format === 'anthropic' ? readAnthropic(data, opts.json) : readOpenAi(data);
    logUsage(step, model, out.usage);
    return {
      content: out.content,
      model: data.model || model,
      usage: out.usage,
      finishReason: out.finishReason,
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

/** The JSON text of an answer for callers that ask for JSON in the prompt only (no json:true, so DeepSeek's request stays as is):
 * fence-stripped; if prose surrounds the JSON, just the JSON; truncated or non-JSON text comes back fence-stripped as it is. */
function jsonText(text) {
  return stripCodeFence(jsonOnly(text));
}

module.exports = { chat, buildRequest, resolveProvider, stripCodeFence, parseJsonContent, jsonText };
