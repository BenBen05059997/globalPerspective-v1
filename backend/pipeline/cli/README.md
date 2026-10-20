# pipeline/cli

Operator tools for the content pipeline. They run from a laptop with the AWS CLI configured; they are not deployed as Lambdas.

## threads.mjs

Inspects and repairs story-thread joins. It uses the AWS CLI, region ap-northeast-1, and imports the join rules from
`NewsProjectInvokeAgentLambda/src/threading.js`, so it applies the same rule the pipeline uses.

- `list-joins --since <date> [--all]`: read-only. Lists archived topics that joined an existing thread under a different title,
  with the score, the title joined, and which rule route the current code gives. Run it to review whether the matcher joined stories sensibly.
- `merge <fromThreadId> <intoThreadId> [--days N] [--apply]`: moves one thread into another. Run it when two threads are the same story.
- `split <threadId> <topicId...> [--days N] [--apply]`: moves the named topics out of a thread into a new one. Run it when stories were wrongly joined.

merge and split read live state, then print every DynamoDB and S3 change. They write only with `--apply`, and only when the
operator has said yes. Each write is conditional on the value read, so a row the pipeline changed in the meantime is skipped.
The stores they touch are NewsCache (archive and latest rows), SummarizeAndPredict (topic rows, thread pointers),
GlobalPerspectivePredictionLog, S3 `threads/story-map.json` and S3 `situations/state/`.

## threads.test.mjs

Offline tests for the planning half (`listJoins`, `planMerge`, `planSplit`); no AWS calls. Run with `node --test backend/pipeline/cli/threads.test.mjs`.

Last verified: 2026-10-20 against code @14dd450d.

## dupes.mjs (read-only)

`node backend/pipeline/cli/dupes.mjs --from 2026-10-06 --to 2026-10-20`
prints JSON evidence pairs across threads (normalized title, explicit continuation, shared URL or passing join score),
and within-thread pairs that fail the current rule for review as potentially mixed threads. It performs one consistent
DynamoDB get-item per date, at most 91 days; it has no write mode. `--since 2026-10-19T09:41:00Z` retains pairs
with at least one entry archived after deployment. Include seven days before that timestamp in the date range to
check whether new entries forked from older coverage. Similarity and shared sources are candidates, not proof that
an event is identical; do not merge connected components automatically. Mutable archive rows cannot reconstruct
all overwritten runs. Correlate candidates with complete paginated `[join]` logs before claiming post-fix counts.
Offline tests: `node --test backend/pipeline/cli/dupes.test.mjs`.

### Repair safety and limits

Cache retags are grouped per item and compare the complete original list before updating it; reordering by a concurrent
pipeline run aborts the repair. TOPIC/PRED rows compare their old threadId. S3 writes require the ETag returned by
get-object. Permission and transport errors abort snapshot collection. A failed write stops the command; earlier writes
can already have succeeded, so inspect partial progress before retrying. This is a multi-store repair, not a transaction.
Merged aliases cannot be used as merge inputs; splits reject missing/duplicate topic ids and existing destinations.
Scans and S3 lists use 100-item pages. The CLI can still be expensive on large tables.

`--snapshot /path/to/snapshot.json` on merge/split prints a plan from a local snapshot (schema is documented in
threads.mjs). It is useful for reviewing archived evidence offline and **cannot** be combined with `--apply`.
An archive-only snapshot does not prove live TOPIC/PRED/S3 change counts. Re-run print-only against live state before
applying. A split leaves existing situation links latched; ask the coordinator for a tracker-aware repair when the map
needs to be split. Derived THREAD_ANALYSIS/history/WEB/DRIFT, web indices, record, weekly and board references are not
rewritten by this CLI. `mergedInto` is stored, but consumers must explicitly support resolving it; verify that support.

`move <fromThreadId> <intoThreadId> <topicId...> [--days N] [--apply]` selectively retags members of a mixed
source into an existing clean destination. It updates topic stores, selected story-map pairs and both pointers; it
leaves situation links for coordinator reconciliation and never aliases the mixed source. When a moved topic was the
source's current pointer, a surviving archived member replaces it. Missing/duplicate ids and merged aliases are refused.

`dupes.mjs --from 2026-10-06 --to 2026-10-19 --method review` reproduces the coordinator's original review method:
within 72 hours, title-token Jaccard >=0.5 plus a shared region/ISO3, or >=0.34 with a shared actor and ISO3.
The default `--method current` retains join-rule/source evidence and mixed-thread candidates. Neither method proves
semantic identity or authorizes automatic merges; countries and actor strings compare after case/whitespace normalization.
