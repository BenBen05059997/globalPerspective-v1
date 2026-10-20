# economy-parked/cli

Operator script for the parked economy group. It is not deployed. It shells out to the AWS CLI with the
operator's own credentials and has no npm dependencies.

## weekly-markets/

- `review.js`: scans SummarizeAndPredict for `draft` weekly markets reports (`WEEKLY_MARKETS#<weekKey>`), shows each mover's note, and lets the operator publish, reject or skip. `--list` only lists drafts. newsWeeklyMarkets now writes `published` directly, so this finds a report only if one was set back to `draft`.
- When to run it: only if a report was held as `draft`. newsWeeklyMarkets now writes `published` directly and its schedule is DISABLED, so it normally finds nothing. The header comment still describes the old draft-first flow.

Last verified: 2026-10-20 against code @14dd450d.
