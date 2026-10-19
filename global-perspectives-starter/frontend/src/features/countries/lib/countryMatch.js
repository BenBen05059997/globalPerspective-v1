// countryMatch — does a story's `regions[]` (free-text names from the AI) name this country? Matched by ISO3
// through the one resolver (shared/lib/countries.js), so "USA", "United States" and "US" are one country and a
// place inside one country ("West Bank") counts for that country. A page name that is not a country (an old
// "Strait of Hormuz" link) still matches its own exact text, never a guess.
import { parentCountry } from '@/shared/lib/countries.js';

export function countryMatcher(countryName) {
  const iso3 = parentCountry(countryName)?.iso3;
  if (!iso3) return (regions) => (regions || []).includes(countryName);
  return (regions) => (regions || []).some((r) => r === countryName || parentCountry(r)?.iso3 === iso3);
}
