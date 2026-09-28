// Economy site-wide soft hide (2026-09-28, TASK_2026-09-27_parking.md "Site changes").
//
// The daily economic-impact job (`newsEconomicImpact` / TriggerNewsEconomicImpact) was disabled
// on 2026-09-28, so every economic_impact / economic_impact_list record is now frozen from
// before 13 Sep. The operator decided to soft-hide the surfaces that still show it (code kept,
// easy to restore — flip this flag back to `false`). `/economy` itself was already soft-hidden
// (direct URL only) since 2026-09-25 and is unaffected by this flag.
//
// Every surface that reads `economic_impact` / `economic_impact_list` (via useEconomicImpact /
// useDisruptionsList) outside of features/economy itself should gate on this flag: skip the
// fetch (pass `enabled: !ECONOMY_PARKED`) and hide the rendered surface.
export const ECONOMY_PARKED = true;
