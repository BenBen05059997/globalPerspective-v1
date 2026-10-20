---
name: weekly-brief
description: Write the analyst's weekly from the backend weekly pull, then validate and stop.
---

1. Read `backend/weekly/README.md`, `backend/weekly/sections.js`, and
   `backend/weekly/schema/weekly.schema.json`. These files define every field, selection rule,
   date rule, section order, label, cap, input path, and command used below.
2. Run the README's pull command for the requested week, saving its inputs JSON. Read that
   entire file, including candidates, logged branches, coverage, exclusions and evidence. Use
   the selected new and moved sets; do not substitute stories or choose by coverage volume.
3. Write a draft JSON conforming to the schema, with the input hash from the pull. Use only
   facts, names, sources, dates, probabilities and numbers present in the relevant inputs.
   Follow the README's honesty and chronology rules. Consult the section model for caps.
   Keep each judgment one plain sentence, spelling out the mechanism and confidence. Cite
   every fact with the exact archive/source tuples from its story. Logged branches are
   historical calls, not newly checked results. Record uncertainty honestly in the schema's
   working-notes field; do not fill gaps from memory or from the example brief.
4. Run the README's check command against the draft and its inputs. Fix all errors and rerun
   until it passes. Inspect word reports to guide the later email rendering; preserve the
   complete JSON within the section item caps. Review every fact against its cited text and
   every judgment for a plain mechanism, because structural checks cannot prove semantics.
5. Stop and report the draft path, inputs path, check output and any unconfirmed facts.
   Publishing is a separate operation; do not invoke publish or hold as part of this skill.
