# 3. S3 for the world, DynamoDB for the user

Status: accepted
Date: 2026-09-08

## Context
About 33 Lambdas batch-produce immutable snapshots that the frontend only reads. Holding them in
DynamoDB had produced 16+ tables, hand-built GSIs, TTLs that deleted wanted history and 400 KB
item caps.

## Decision
We will store everything the pipeline computes about the world as versioned JSON in the private S3
world bucket, and only per-user, mutable data in DynamoDB. Sorting test: "if this user deleted
their account, would the data disappear?" No means S3; yes means DynamoDB. A new table needs a
recorded exception.

## Consequences
- S3 rules: one writer per prefix; sources append to an `inbox/` and one folder Lambda owns
  `state/`; no `ListObjects` on a hot path (owners keep an `index.json`); snapshots are immutable
  with a `latest` pointer; writers stamp freshness; the bucket stays private and browsers read
  through the Cloudflare Worker; lifecycle rules replace TTL; conditional writes only where a
  read-modify-write cannot be avoided.
- Recorded exception: `GlobalPerspectiveShares` (2026-09-30, Batch 4 Y1).
- Full rules and the prefix ownership table: `project-docs/architecture/DATA_STRATEGY.md`.

Source: `project-docs/architecture/DATA_STRATEGY.md`
