# 1. The product is an analyst sense-making tool, not a signal API

Status: accepted
Date: 2026-06-26

## Context
The earlier framing was to sell machine-readable signals (a pure signal API). Two deep-research
passes on 2026-06-26 found that funded comparables sell to human analysts and risk desks, and that
the machine-buyer market is less proven.

## Decision
We will build an analyst-facing reasoning tool over a causal event-web (how a story formed, what
it is likely to trigger, what would falsify a thesis). The signal API may remain as plumbing but
is not the product.

## Consequences
- Pages are designed for thesis-producing analysts; the web, provenance and counter-events are the
  differentiators.
- The signal API (`newsSignals`) is not sold; whether to park it is still open (see 0015).

Source: `project-docs/archive/strategy/ANALYST_TOOL_DIRECTION.md`;
`project-docs/archive/causal-web/_proposed/ENTERPRISE_ANALYST_TOOL_PLAN.md`
