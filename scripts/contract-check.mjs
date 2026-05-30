#!/usr/bin/env node
/**
 * Class-4 (API contract drift) boundary check — BUG_PLAYBOOK.md.
 *
 * The frontend reads specific fields off each proxy action. When the backend
 * renames/removes a field, or changes its type (the b0f84bc bug: a numeric
 * field arriving as a string → NaN% in the UI), nothing fails loudly — the page
 * just renders garbage. This script calls each key proxy action against the live
 * backend and validates the response against a Zod schema that encodes ONLY the
 * load-bearing fields the frontend actually depends on.
 *
 * Schemas are deliberately lenient about EXTRA fields (backend may add them) and
 * strict about the shape/type of fields we consume. A failure = real drift.
 *
 * Usage: node scripts/contract-check.mjs
 *        SMOKE_BASE=... (proxy endpoint override; defaults to production)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const FE = path.join(__dir, '../global-perspectives-starter/frontend');
const { z } = await import(path.join(FE, 'node_modules/zod/index.js'));

const EP = process.env.PROXY_ENDPOINT
  || 'https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy';

async function call(action, payload = {}) {
  const res = await fetch(EP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  let body;
  try { body = await res.json(); } catch { body = null; }
  // Unwrap Lambda-proxy envelope { statusCode, body } if present.
  if (body && typeof body === 'object' && 'statusCode' in body && 'body' in body) {
    try { body = typeof body.body === 'string' ? JSON.parse(body.body) : body.body; } catch { /* keep */ }
  }
  return body;
}

// ── Schemas: envelope + the fields the frontend reads ────────────────────────
const sourceShape = z.object({
  url: z.string(),
  title: z.string(),
  source: z.string(),
});

const SCHEMAS = {
  topics: z.object({
    success: z.literal(true),
    data: z.object({
      topics: z.array(z.object({
        regions: z.array(z.string()),
        sources: z.array(sourceShape).min(1),
      })).min(1),
    }),
  }),

  markets_global: z.object({
    success: z.literal(true),
    data: z.object({
      fx: z.object({
        rates: z.record(z.string(), z.number()),
        base: z.string(),
      }),
      commodities: z.record(z.string(), z.union([z.number(), z.string()])),
    }),
  }),

  // The /economy + disruption links are built from scopeId — a missing/renamed
  // scopeId here is BOTH a class-4 drift AND a class-1 dead-link source.
  economic_impact_list: z.object({
    success: z.literal(true),
    data: z.array(z.object({ scopeId: z.string() })),
  }),

  // data is null when no brief has been generated yet (valid empty state, class 6).
  // When present, risingThread.threadId must be a string (the /daily bug field).
  daily_brief: z.object({
    success: z.literal(true),
    data: z.union([
      z.null(),
      z.object({
        risingThread: z.object({ threadId: z.string().optional() }).passthrough().optional(),
      }).passthrough(),
    ]),
  }),

  narrative_thread: z.object({
    success: z.literal(true),
    threadId: z.string(),
    data: z.array(z.object({
      topicId: z.string(),
      threadId: z.string(),
      sources: z.array(z.object({}).passthrough()),
    })).min(1),
  }),

  // record<threadId, analysis>; assert riskScore is numeric where present (NaN guard).
  thread_analysis: z.object({
    success: z.literal(true),
    data: z.record(z.string(), z.object({ riskScore: z.number() }).passthrough()),
  }),

  country_intelligence: z.object({
    success: z.literal(true),
    data: z.record(z.string(), z.object({
      riskScore: z.number(),
      riskLevel: z.string(),
    }).passthrough()),
  }),
};

(async () => {
  console.log('\nContract-drift check (class 4) against');
  console.log(`  ${EP}`);
  console.log('='.repeat(72));

  // A real threadId for the parameterized actions.
  let tid = '';
  try {
    const list = await call('economic_impact_list', {});
    tid = (list?.data?.[0]?.scopeId) || (list?.data?.[0]?.threadId) || '';
  } catch { /* ignore */ }

  const PAYLOADS = {
    topics: {},
    markets_global: {},
    economic_impact_list: {},
    daily_brief: {},
    narrative_thread: { threadId: tid },
    thread_analysis: { threadIds: [tid] },
    country_intelligence: { countryNames: ['United States'] },
  };

  let failed = 0;
  for (const [action, schema] of Object.entries(SCHEMAS)) {
    if ((action === 'narrative_thread' || action === 'thread_analysis') && !tid) {
      console.log(`  ?  ${action} — skipped (no threadId available to probe)`);
      continue;
    }
    let resp;
    try {
      resp = await call(action, PAYLOADS[action]);
    } catch (e) {
      failed++;
      console.log(`  X  ${action} — request failed: ${(e.message || '').slice(0, 80)}`);
      continue;
    }
    const r = schema.safeParse(resp);
    if (r.success) {
      console.log(`  ok ${action}`);
    } else {
      failed++;
      console.log(`  X  ${action} — schema mismatch (frontend reads a field that drifted):`);
      for (const issue of r.error.issues.slice(0, 6)) {
        console.log(`        ${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
    }
  }

  console.log('='.repeat(72));
  if (failed) {
    console.log(`\nFAIL: ${failed} action(s) drifted from the contract the frontend expects.`);
    console.log(`Align the frontend reader to the live shape — never coerce undefined.\n`);
    process.exit(1);
  }
  console.log('\nPASS: all probed actions match the fields the frontend depends on.\n');
  process.exit(0);
})();
