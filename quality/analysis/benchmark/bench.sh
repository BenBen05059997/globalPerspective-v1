#!/usr/bin/env bash
# quality/analysis/benchmark/bench.sh — one command to run the whole benchmark.
#
# Pulls the DeepSeek key from the Lambda config (so you never handle it), then runs
# the panel benchmark → scorecard + DASHBOARD.md, and points you at the human-review
# queue. On-demand only (no CI — solo dev).
#
#   bash quality/analysis/benchmark/bench.sh                 # run the panel benchmark
#   bash quality/analysis/benchmark/bench.sh --capture       # refresh frozen cases first
#   bash quality/analysis/benchmark/bench.sh --pro           # analyst = v4-pro (is Pro worth it?)
#
# After a run with panel-splits:  node quality/analysis/benchmark/review.mjs
set -euo pipefail
cd "$(dirname "$0")/../../.."   # repo root

REGION=ap-northeast-1
KEY=$(aws lambda get-function-configuration --function-name newsEconomicImpact --region "$REGION" --query 'Environment.Variables.XAI_API_KEY' --output text 2>/dev/null)
if [ -z "$KEY" ] || [ "$KEY" = "None" ]; then echo "Could not fetch DeepSeek key from Lambda config." >&2; exit 1; fi

if [ "${1:-}" = "--capture" ]; then
  echo "→ refreshing frozen cases from live stories…"
  node quality/analysis/benchmark/capture.mjs
  shift || true
fi

ANALYST_MODEL="deepseek-v4-flash"
if [ "${1:-}" = "--pro" ]; then ANALYST_MODEL="deepseek-v4-pro"; shift || true; fi

echo "→ running panel benchmark (analyst=$ANALYST_MODEL)…"
ANALYSIS_EVAL_KEY="$KEY" ANALYSIS_BENCH_MODEL="$ANALYST_MODEL" node quality/analysis/benchmark/run.mjs

echo
echo "Done. Review any panel-splits with:  node quality/analysis/benchmark/review.mjs"
