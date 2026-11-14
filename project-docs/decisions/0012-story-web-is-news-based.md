# 12. A story's web is its own news; links are "judged to feed into", never "caused"

Status: accepted
Date: 2026-09-25

## Context
The story web had been built from country webs, which cover about 24% of stories. In the debate,
every advocate mis-stated the data (swapped confidences, an invented turning point, invented
quotes, "caused"). The operator delegated the rethink and its ruling.

## Decision
We will make the web on a story news-based: the timeline (the story's own dated news) is the
spine, and links between stories are shown as evidence. Direction and confidence are always words;
mechanisms are always quoted verbatim; a link is "judged to feed into", never "caused". No second,
duplicate web graphic in v1, and no new identity layer (the Event Registry is the identity layer;
post-hoc fuzzy matching stays banned).

## Consequences
- Model output on pages is labelled "model judgment".
- The Stories WEB view and the story page follow these wording rules.

Source: `git show 120de90:project-docs/archive/redesign-ux/_active/STORY_WEB_RETHINK_PLAN.md` (deleted 2026-10-19) (§5 ruling);
`git show a5c0de8:project-docs/plans/REDESIGN_MASTER_PLAN.md` (deleted 2026-10-19) (§1 honesty rules)

## Amended by 0058 (2026-11-10, direction accepted; applies as each step ships)
Themes are groups of judged links ("judged to feed into"): weak links count (a weak link attaches only a group of 2 or fewer, 0058 rule 9); texture follows `ARCHITECTURE_BOARD.md` section 3 (a link of ours is dashed until the weekly review confirms it, solid only after; operator, 2026-11-10); shared-actor pairs do not join groups. The wording rules stay. See [0058](0058-one-story-description-regions-themes.md).
