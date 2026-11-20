# 64. One promise sentence for readers, the words "story" and "step" on every page, plain words for the three kinds, and Today as a tab

Status: accepted (operator, chat, 2026-11-19: "Okay, I agree with you. This choices, so you can mark it down."); built and live: the site was released 2026-11-19 (Cloudflare versions cc697763 then a1787828, about 22:00 to 23:10 UTC, verified), with the screens in commit 9605062e. Amends 0029 (Today becomes a tab) and 0063 item 7 (label words). Follows 0016, 0058, 0063.
Date: 2026-11-19

## Context
- 0063 built story kinds in the backend (branch `story-kinds`; deployed 2026-11-19). A first-time reader still could not say what the site does with the news, what "a story" is, or why an item is on the page. The pages used many words for the same thing: topic, arc, thread, situation, entry, event, lede.
- The first reader mock (a small line drawing and the code labels START / MOVE on the old pages) was rejected by the operator as patching: it had no central idea.
- A team of three agents (planner, front-end designer, tester as a first-time reader) worked in three rounds and merged one proposal. The papers are local, not in git: `.board/reviews/story-kinds-plan-2026-11-18/team/` (`3-centre.md` is the merged proposal).
- The proposal marked three points as the operator's, because they change decision records or positioning copy. The operator said yes to all three.

## Decision
1. **The promise sentence.** "We follow the world's stories day by day: how each began, what moved it today, and what to watch next." It is the first line on the Map (visitors land there, 0016), and Today and the "?" page repeat it. The old tagline and the forecast-count line keep their words and move lower; they are not removed.
2. **Two nouns.** "Story" is the thing we follow; it replaces topic, arc, thread and (where it is a story) situation in what readers see. "Step" is one dated item in a story; it replaces entry, event and report in what readers see. Field names, routes and code keep their names.
3. **Kind words on cards and the story page.** "Starts a story", "Moves a story", "Measured change", in place of START, MOVE, MEASURED CHANGE (amends 0063 item 7). The values of `role` (`start`, `move`, `measure`, null) and the rule that stamps them do not change. Measured change keeps the MODEL JUDGMENT tag (0012).
4. **Today is a tab.** Today joins the top bar and the phone tab bar, between Map and Stories (amends 0029, which kept it as a link from the map's About content). The route `/today` does not change.

## Not decided here
- The screen design: how a card shows a story's earlier steps and today's step, Today grouped by kind, the leave-out line, the "What we watch next" line and its Track record link. It was settled afterwards in the team's papers and built (see Status); this record does not fix it.
- A story has no name apart from its newest headline (0058 rule 1). No name is invented; a separate name would need a new builder field and its own decision. Decision 0065 took it.
- When the built work goes live. It went live 2026-11-19 (see Status). Every Lambda round and frontend release needs the operator's yes (0063 rollout).

## Consequences
- `EntryRole.jsx` and every place that prints START / MOVE change their words when this is built.
- The nav gains a fifth tab on desktop and phone.
- Reader-facing copy that says topic, arc, thread or entry is reworded when its page is built; nothing is removed.
