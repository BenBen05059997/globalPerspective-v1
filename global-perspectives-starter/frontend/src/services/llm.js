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

export const PROVIDERS = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    type: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    keyHint: 'sk-…',
    models: ['deepseek-chat', 'deepseek-reasoner'],
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
  },
];

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) || null;
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
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || JSON.stringify(body) || res.statusText;
    throw new Error(`${provider.label} ${res.status}: ${msg}`);
  }
  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.label}: empty response`);
  return text;
}

async function runAnthropic(provider, { model, apiKey, system, user, maxTokens, temperature }) {
  const res = await fetch(`${provider.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Anthropic's official opt-in to allow calls straight from the browser.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || JSON.stringify(body) || res.statusText;
    throw new Error(`${provider.label} ${res.status}: ${msg}`);
  }
  const text = Array.isArray(body?.content)
    ? body.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
    : null;
  if (!text) throw new Error(`${provider.label}: empty response`);
  return text;
}

// Run one analysis. `system` + `user` are plain strings; returns the model's text.
export async function runChat({ provider, model, apiKey, system, user, maxTokens = 1600, temperature = 0.3 }) {
  const p = getProvider(provider);
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  if (!apiKey) throw new Error('No API key set');
  const args = { model, apiKey, system, user, maxTokens, temperature };
  return p.type === 'anthropic' ? runAnthropic(p, args) : runOpenAICompat(p, args);
}
