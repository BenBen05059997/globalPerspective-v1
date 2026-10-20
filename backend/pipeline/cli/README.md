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
