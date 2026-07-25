Read ANALYZE_OPTIONS_PRUNE_QUEUE.md. Pick the FIRST unchecked `[ ]` item under "Loop-safe items" and do ONLY that one, applying its Recipe EXACTLY (these are precise subtractions/edits — do not free-author, do not batch items, do not touch adjacent lenses/providers).

Hard rules:
- Preserve every honesty guardrail (anti-fabrication prompt wording, validateStruct, the validator). Do not touch utils/analysisValidator.js.
- Then run: cd global-perspectives-starter/frontend && npm run verify
- If verify is GREEN: commit locally with a conventional message `refactor(analyze): <item summary>` (docs items use `docs(analyze): …`), mark the item `[x]` in the queue, and append a one-line Log entry (date · item# · verify green · net diff).
- If verify is RED: revert this item's change so the tree is clean, mark the item `BLOCKED: <reason>` in the queue, and STOP.
- Do NOT push. Do NOT run ./deploy.sh. Do NOT start a second item. Stop after this one.
- Skip anything under "BLOCKED / human-only". If only BLOCKED items remain, stop.
