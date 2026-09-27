import { describe, it, expect, vi, afterEach } from 'vitest';
import { runChat, openAIUsage, anthropicUsage } from '../llm.js';

describe('openAIUsage / anthropicUsage — pure extraction', () => {
  it('reads prompt/completion tokens + model from an OpenAI-compatible body', () => {
    const body = { model: 'deepseek-v4-pro', usage: { prompt_tokens: 1200, completion_tokens: 340, total_tokens: 1540 } };
    expect(openAIUsage(body, 'requested-model')).toEqual({ inputTokens: 1200, outputTokens: 340, model: 'deepseek-v4-pro' });
  });

  it('falls back to the requested model id when the body carries none', () => {
    const body = { usage: { prompt_tokens: 10, completion_tokens: 5 } };
    expect(openAIUsage(body, 'gpt-5.6')).toEqual({ inputTokens: 10, outputTokens: 5, model: 'gpt-5.6' });
  });

  it('returns null when the response has no usage object at all', () => {
    expect(openAIUsage({ model: 'x' }, 'x')).toBeNull();
    expect(anthropicUsage({ model: 'x' }, 'x')).toBeNull();
  });

  it('reads input/output tokens from an Anthropic Messages body', () => {
    const body = { model: 'claude-sonnet-5', usage: { input_tokens: 900, output_tokens: 210 } };
    expect(anthropicUsage(body, 'requested')).toEqual({ inputTokens: 900, outputTokens: 210, model: 'claude-sonnet-5' });
  });
});

describe('runChat — usage flows through on the run result', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

  it('DeepSeek (OpenAI-compatible): usage attached to the result', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'deepseek-v4-pro',
        choices: [{ message: { content: 'Analysis text [1].' } }],
        usage: { prompt_tokens: 500, completion_tokens: 150, total_tokens: 650 },
      }),
    });
    const r = await runChat({ provider: 'deepseek', model: 'deepseek-v4-pro', apiKey: 'sk-test', system: 'sys', user: 'usr' });
    expect(r.text).toBe('Analysis text [1].');
    expect(r.usage).toEqual({ inputTokens: 500, outputTokens: 150, model: 'deepseek-v4-pro' });
  });

  it('Anthropic: usage attached to the result', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'claude-sonnet-5',
        content: [{ type: 'text', text: 'Analysis text [1].' }],
        usage: { input_tokens: 800, output_tokens: 220 },
      }),
    });
    const r = await runChat({ provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'sk-ant-test', system: 'sys', user: 'usr' });
    expect(r.text).toBe('Analysis text [1].');
    expect(r.usage).toEqual({ inputTokens: 800, outputTokens: 220, model: 'claude-sonnet-5' });
  });

  it('a provider response with no usage object yields usage: null (renders as "Provider did not report usage")', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'No usage here [1].' } }] }),
    });
    const r = await runChat({ provider: 'openai', model: 'gpt-5.6', apiKey: 'sk-test', system: 'sys', user: 'usr' });
    expect(r.usage).toBeNull();
  });
});
