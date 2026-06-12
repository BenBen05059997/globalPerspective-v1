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

async function runOpenAICompat(provider, { model, apiKey, system, user, maxTokens, temperature }) {
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
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
export async function runChat({ provider, model, apiKey, system, user, maxTokens = 1600, temperature = 0.3, webResearch = false }) {
  const p = getProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  if (!apiKey) throw new Error('No API key set');
  if (webResearch && !p.webSearch) {
    // Refuse rather than fake it: prompting a no-search API to "search the web"
    // produces invented sources — the exact failure this feature exists to prevent.
    throw new Error(`${p.label} cannot search the web from its API. Pick Perplexity or Anthropic for Deep research.`);
  }
  const args = { model, apiKey, system, user, maxTokens, temperature, webResearch };
  return p.type === 'anthropic' ? runAnthropic(p, args) : runOpenAICompat(p, args);
}
