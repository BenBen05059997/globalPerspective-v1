# Briefing checks

`node quality/briefing/verify_lede.mjs` runs the real Today lede function
(`features/home/lib/composeTopicsLede.js`) against inline cases and proves it never fabricates: the headline is a verbatim
input title, every count is a real tally, and the reason (urgent, trending, source count) traces to a signal on the chosen topic.

The economy briefing eval set that lived here (fixtures, assertions, targets) went with the economy product (decision 0049);
`git log` keeps it.
