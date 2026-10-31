# 0045: The weekly draw's eligibility window is 7-90 days, everywhere

Date: 2026-10-31. Status: accepted (operator). Resolves the open question in 0043 (eligibility window).

## Context
A question can be picked in the weekly sealed draw only if its deadline is 7 to N days after it was issued. The rule had
two values:
- the draw itself (`newsPredictionResolver` `src/lib.js` `LEAD_MAX`) and decision 0038 used 7-90;
- the public track record page ("Only questions with a 7 to 84 day lead time are eligible"), the snapshot board
  (`newsPredictionsSnapshot` `questionBoard.js` `METHOD.leadDays`), the read API's sample state
  (`newsSensitiveData` `src/lib.js`), the record views (`shared/src/questionState.js` `LEAD_MAX`) and the
  question chips used 7-84.

On 2026-10-31, 16 of the 66 drawn questions had leads of 85-90 days. A reader checking a draw against the published rule
would find picks that break it.

## Decision
The window is 7-90 days in every place: the draw keeps the rule it has always run, the page text, labels and views
follow it. All 66 past picks are valid under the published rule. No draw, commitment or verdict changes.

## Consequences
- Questions issued 85-90 days before their deadline that were not drawn change from `not_eligible` to `not_sampled`
  (or `warm_up` / `awaiting_draw`) in the views and the read API.
- The accuracy estimate's published-method default (`accuracyEstimate.js` `maxLead`) is 90; the live page uses the
  observed lead times (66 questions), so its dates do not move.
- Any future change to the window changes the resolver and `questionState.js` together, and the page text with them.
