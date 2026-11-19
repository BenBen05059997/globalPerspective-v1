# 65. A story gets a short name from the weekly review; pages show it beside the newest headline

Status: accepted (operator, chat, 2026-11-19: the coordinator recommended option B of the back-end scope, a name from the weekly review's existing call, and the operator answered "I mean go"); built on branch `story-kinds`, tested offline; NOT DEPLOYED. The review prompt `review-7` has not run the golden-week gates. Every Lambda update and site release needs the operator's yes. Amends 0058 rule 1 and the second "Not decided here" line of 0064. Follows 0037, 0039, 0060, 0063.
Date: 2026-11-19

## Context
A story's only title is the headline of its newest step (0037 amendment of 2026-11-04, 0058 rule 1). It changes with every step, so a reader cannot recognise a story from one day to the next. 0064 left this open: "a separate name would need a new builder field and its own decision". Three options were scoped in `backend-story-name.md`; the operator chose option B: a name written in the weekly review's existing call.

## Decision
1. The weekly review (`newsRecordReview`, prompt `review-7`) may return `name` next to `line` in the call it already makes for each story. No new call and no new model.
2. A name is kept only if the code finds that it is non-empty, has at most 8 words and 80 characters, cites the story's own entries, and is not the story's title or any headline the model was shown (lower case, punctuation removed). A rejected name means no name; nothing is invented in its place.
3. The review sees the story's current name (from the builder's stamp) and answers null while it still fits, so a name stays the same across weeks. A newer accepted name replaces it.
4. The builder (`newsStoryRecord`) stamps `name` in the story stamp (0058 rule 7): on the story view, the index rows, the `index/today.json` story cards and every other stamp carrier. `name` is null until the review names the story. The builder never fills it from the title.
5. On a merge the survivor keeps its own name; the merged-away story's name is not carried over.
6. Pages show `name` when it is set and the newest headline (`title`) otherwise. `title` keeps its 0037/0058 rule 1 meaning and stays on every view.

Amends 0058 rule 1: the story title stays the newest headline; a story may also carry a `name`, the weekly review's checked short name, which is not a title and not a model paraphrase of one (`analysis.threadTitle` stays an analysis field).
Amends 0064 "Not decided here", second line: replaced by this record.

## Consequences
- The review's output grows by about 20 tokens per call, and its prompt grows by 569 characters (estimate: about $0.25 to $0.35 a week at the current Sonnet price; not measured).
- `review-7` must pass the golden-week gates, plus a hand count of name rejections and a read of the 27 names, before it is deployed.
- Live stories have no name until the first Monday run of `review-7` after it is deployed; until then every `name` is null and pages show the headline.
- The golden fixture cannot test the "keep the name" path (no earlier readings); the first live run is the first real test.
- The rows of `all.json` grow by about 12 bytes each while `name` is null.
