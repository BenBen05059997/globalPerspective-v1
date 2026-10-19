// Real-country rule for the frontend (Batch 3 / phase F): the `regions` on archive entries include aggregates
// (Europe, Asia, Middle East, Americas, Africa, Global, European Union, NATO ...) that are not countries.
// The rule is the one country resolver (shared/lib/countries.js), the same one the briefing Lambdas use
// through backend/shared/src/placeFilter.js. Kept as a thin re-export for its callers.
import { isCountry } from '@/shared/lib/countries.js';

/** isRealCountryName - a country or territory (not a region / aggregate / sub-national place). */
export const isRealCountryName = isCountry;
