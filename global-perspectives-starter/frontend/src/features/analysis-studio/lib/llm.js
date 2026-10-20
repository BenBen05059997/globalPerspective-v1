// imported by Node tooling outside src/ — keep relative imports
// BYOK (Bring-Your-Own-Key) LLM client for the Analysis Studio (/analyze).
//
// The user picks a provider + model and pastes THEIR OWN key. The key lives only
// in the browser (see shared/lib/byok.js) and the chat call goes browser → provider
// directly — our servers never see, log, or store it.
//
// Two code paths:
//   - OpenAI-compatible chat/completions: OpenAI, DeepSeek, Gemini (compat)
//   - Anthropic Messages API: separate shape + the direct-browser-access header
//
// ⚠️ Direct browser calls depend on each provider's CORS policy. Where a provider
// blocks browser origins the fetch will fail with a CORS/network error — surfaced
// honestly to the user. (The eventual fallback is a no-store pass-through Lambda.)

import { getProvider } from '../../../shared/lib/llmProviders.js';

// Receipt data (D3): the provider's own `usage` object, plus the model id the
// response actually reports (may differ from the model id we requested — e.g. an
// alias resolving to a dated snapshot). Returns null when the provider's response
// carried no usage at all, so the UI can say so honestly instead of guessing.
//
// OpenAI-compatible chat/completions (OpenAI, DeepSeek, Perplexity, Gemini-compat,
// Qwen) documents a non-streaming `usage: { prompt_tokens, completion_tokens, … }`.
export function openAIUsage(body, fallbackModel) {
  const u = body?.usage;
  const inputTokens = u?.prompt_tokens ?? null;
  const outputTokens = u?.completion_tokens ?? null;
  if (inputTokens == null && outputTokens == null) return null;
  return { inputTokens, outputTokens, model: body?.model || fallbackModel || null };
}

// Anthropic's Messages API documents `usage: { input_tokens, output_tokens }` on
// every non-streaming response.
export function anthropicUsage(body, fallbackModel) {
  const u = body?.usage;
  const inputTokens = u?.input_tokens ?? null;
  const outputTokens = u?.output_tokens ?? null;
  if (inputTokens == null && outputTokens == null) return null;
  return { inputTokens, outputTokens, model: body?.model || fallbackModel || null };
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
      // on providers that declare it, so OpenAI/Gemini are unaffected.
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
  return { text, webSources: openAIWebSources(body), usage: openAIUsage(body, model) };
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
  return { text, webSources, usage: anthropicUsage(body, model) };
}

// Run one analysis. `system` + `user` are plain strings.
// Returns { text, webSources:[{title,url}], usage } — webSources is [] unless the
// provider searched the web (Perplexity always; Anthropic when `webResearch` is
// set). `usage` is { inputTokens, outputTokens, model } from the provider's own
// response, or null when it reported none (D3 receipt data).
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
