// LLM provider catalog: which providers/models a user can pick and how each is called.
// Pure data used by the eval client (analysis-studio/lib/llm.js, imported by the quality/analysis Node
// tooling, so no imports here). No page uses it since the Studio retired (2026-10-20).

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
    // GPT-5.6 family (released 2026-07-09): gpt-5.6 = Sol (flagship, alias), terra =
    // balanced, luna = fast/cheap. Flagship first (Studio defaults to models[0]).
    models: ['gpt-5.6', 'gpt-5.6-terra', 'gpt-5.6-luna'],
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    type: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyHint: 'AIza…',
    // Gemini 3.x (GA mid-2026): 3.6-flash (latest stable), 3.5-flash (named stable),
    // 3.5-flash-lite (low-cost). Verified vs ai.google.dev model docs 2026-07-26.
    models: ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'],
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
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyHint: 'sk-ant-…',
    // Current Claude model IDs (verified 2026-07-26; re-confirm vs the claude-api ref if a run 404s).
    models: ['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5-20251001', 'claude-fable-5'],
    webSearch: 'tool',
  },
];

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) || null;
}
