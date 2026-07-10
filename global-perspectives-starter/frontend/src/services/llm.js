// BYOK (Bring-Your-Own-Key) LLM client for the Analysis Studio (/analyze).
//
// The user picks a provider + model and pastes THEIR OWN key. The key lives only
// in the browser (see utils/byok.js) and the chat call goes browser → provider
// directly — our servers never see, log, or store it.
//
// Two code paths:
//   - OpenAI-compatible chat/completions: OpenAI, DeepSeek, Gemini (compat), OpenRouter
//   - Anthropic Messages API: separate shape + the direct-browser-access header
//
// ⚠️ Direct browser calls depend on each provider's CORS policy. Where a provider
// blocks browser origins the fetch will fail with a CORS/network error — surfaced
// honestly to the user. (The eventual fallback is a no-store pass-through Lambda.)

// `webSearch` capability per provider:
//   'always' — every call searches the web natively (Perplexity sonar)
//   'tool'   — search happens only when we attach the provider's web-search tool (Anthropic)
//   absent   — the API cannot search; Deep-research mode is disabled for it (honest gating,
//              never silently degraded: a "search the web" prompt to a no-search API would
//              make the model FAKE having searched).
export const PROVIDERS = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    type: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    keyHint: 'sk-…',
    // Explicit V4 IDs (verified against the live /models endpoint 2026-06-12) so the
    // version is visible. The old deepseek-chat/-reasoner aliases now just point at
    // V4-Flash and retire 2026-07-24 — kept as clearly-labelled legacy fallbacks.
    models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'],
    modelLabels: {
      'deepseek-v4-flash': 'DeepSeek V4 Flash — fast',
      'deepseek-v4-pro': 'DeepSeek V4 Pro — strongest (best for analysis)',
      'deepseek-chat': 'deepseek-chat (legacy → V4 Flash, retires Jul 24 2026)',
      'deepseek-reasoner': 'deepseek-reasoner (legacy → V4 Flash thinking, retires Jul 24 2026)',
    },
    // V4 models default to THINKING mode (emit reasoning_content, burn the token
    // budget, and can truncate the answer). Force the plain non-thinking chat the
    // Studio expects — verified accepted by all four DeepSeek model IDs above.
    extraBody: { thinking: { type: 'disabled' } },
  },
  {
    id: 'perplexity',
    label: 'Perplexity (built-in web search)',
    type: 'openai',
    baseUrl: 'https://api.perplexity.ai',
    keyHint: 'pplx-…',
    // Sonar models always search the web and return `citations`/`search_results`.
    models: ['sonar-pro', 'sonar', 'sonar-reasoning-pro', 'sonar-deep-research'],
    webSearch: 'always',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    keyHint: 'sk-…',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    type: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyHint: 'AIza…',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  },
  {
    id: 'qwen',
    label: 'Alibaba Qwen',
    type: 'openai',
    // OpenAI-compatible ("compatible-mode") endpoint of Alibaba Cloud Model Studio /
    // DashScope. International endpoint — verified against the Model Studio docs
    // 2026-07-10. (China-region key holders use dashscope.aliyuncs.com instead.)
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    keyHint: 'sk-… (workspace keys: sk-ws-…)',
    // qwen3.7-max is the current flagship (Alibaba Cloud Summit, May 2026) — 1M ctx,
    // strongest for reasoning/analysis. qwen3-max is the prior-gen flagship; -plus is
    // the low-cost multimodal tier. Flagship listed first (Studio defaults to models[0]).
    models: ['qwen3.7-max', 'qwen3-max', 'qwen3.7-plus'],
    // Alibaba's WORKSPACE-scoped international keys (sk-ws-…) 401 against the generic
    // host above — they need a workspace-specific host with the WorkspaceId baked in,
    // e.g. https://<WorkspaceId>.ap-northeast-1.maas.aliyuncs.com/compatible-mode/v1
    // (Tokyo) or …ap-southeast-1… (Singapore). Verified live 2026-07-10: generic host
    // 401s an sk-ws- key, workspace host returns 200. Let the user override the host.
    allowBaseUrlOverride: true,
    modelLabels: {
      'qwen3.7-max': 'Qwen3.7-Max — flagship (strongest for analysis)',
      'qwen3-max': 'Qwen3-Max — prior-gen flagship',
      'qwen3.7-plus': 'Qwen3.7-Plus — low-cost',
    },
    // qwen3.x models default to extended-thinking (reasoning_content), which on a
    // NON-streaming call (what the Studio makes) burns the token budget and can
    // truncate the answer — same failure mode we disabled for DeepSeek V4. Force
    // plain non-thinking chat. (First thing to confirm live before trusting output.)
    extraBody: { enable_thinking: false },
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    type: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyHint: 'sk-or-…',
    models: [
      'deepseek/deepseek-chat',
      'openai/gpt-4o',
      'anthropic/claude-sonnet-4.6',
      'google/gemini-2.5-flash',
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyHint: 'sk-ant-…',
    // Current Claude model IDs (confirm against the claude-api reference before shipping).
    models: ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001', 'claude-fable-5'],
    webSearch: 'tool',
  },
];

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) || null;
}

// Normalize the provider's web-source metadata to [{ title, url }].
function openAIWebSources(body) {
  // Perplexity: `search_results` [{title,url,date}] (richer) and/or `citations` [url,…].
  if (Array.isArray(body?.search_results) && body.search_results.length) {
    return body.search_results
      .map((r) => ({ title: r.title || r.url, url: r.url }))
      .filter((r) => r.url);
  }
  if (Array.isArray(body?.citations) && body.citations.length) {
    return body.citations.filter(Boolean).map((u) => ({ title: u, url: u }));
  }
  return [];
}

async function runOpenAICompat(provider, { model, apiKey, system, user, maxTokens, temperature, baseUrl }) {
  // Per-provider base-URL override (currently only `qwen`, for workspace-scoped
  // sk-ws- keys that need a WorkspaceId-specific host). Falls back to the provider
  // default for everyone else — unchanged behaviour when unset.
  const base = baseUrl || provider.baseUrl;
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      // Provider-specific extras (e.g. DeepSeek's thinking:disabled). Only present
      // on providers that declare it, so OpenAI/Gemini/OpenRouter are unaffected.
      ...(provider.extraBody || {}),
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || JSON.stringify(body) || res.statusText;
    throw new Error(`${provider.label} ${res.status}: ${msg}`);
  }
  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.label}: empty response`);
  return { text, webSources: openAIWebSources(body) };
}

async function runAnthropic(provider, { model, apiKey, system, user, maxTokens, temperature, webResearch }) {
  const payload = {
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content: user }],
  };
  // Anthropic's official server-side web-search tool — the model searches and the
  // response carries real source citations. Only attached in Deep-research mode.
  if (webResearch) {
    payload.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }];
  }
  const res = await fetch(`${provider.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Anthropic's official opt-in to allow calls straight from the browser.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || JSON.stringify(body) || res.statusText;
    throw new Error(`${provider.label} ${res.status}: ${msg}`);
  }
  const blocks = Array.isArray(body?.content) ? body.content : [];
  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  if (!text) throw new Error(`${provider.label}: empty response`);
  // Web sources come back as citation objects attached to text blocks.
  const webSources = [];
  const seen = new Set();
  for (const b of blocks) {
    for (const c of b.citations || []) {
      if (c.url && !seen.has(c.url)) {
        seen.add(c.url);
        webSources.push({ title: c.title || c.url, url: c.url });
      }
    }
  }
  return { text, webSources };
}

// Run one analysis. `system` + `user` are plain strings.
// Returns { text, webSources:[{title,url}] } — webSources is [] unless the provider
// searched the web (Perplexity always; Anthropic when `webResearch` is set).
export async function runChat({ provider, model, apiKey, system, user, maxTokens = 1600, temperature = 0.3, webResearch = false, baseUrl }) {
  const p = getProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  if (!apiKey) throw new Error('No API key set');
  if (webResearch && !p.webSearch) {
    // Refuse rather than fake it: prompting a no-search API to "search the web"
    // produces invented sources — the exact failure this feature exists to prevent.
    throw new Error(`${p.label} cannot search the web from its API. Pick Perplexity or Anthropic for Deep research.`);
  }
  const args = { model, apiKey, system, user, maxTokens, temperature, webResearch, baseUrl };
  return p.type === 'anthropic' ? runAnthropic(p, args) : runOpenAICompat(p, args);
}
