# Geocoding Performance Optimizations

This app uses OpenStreetMap Nominatim to geocode locations extracted from topic/article titles. To reduce latency and avoid unnecessary requests, the following optimizations were implemented without changing UI or other pages:

## Changes
- Stricter location extraction: a blocklist filters common capitalized non-location words (e.g., Ceasefire, Negotiations, Humanitarian, Crisis, Conflict, War, Aid, Talks, Agreement, Sanctions). This prevents false positives.
- Prioritized keywords: known locations (countries, major cities, regions) are prioritized when attempting geocoding.
- Attempt cap: per article, geocoding tries at most three location candidates. This cuts worst-case request counts while still resolving most titles.
- In-flight request dedupe: concurrent geocode requests for the same `(countryCode, location)` reuse the same promise to avoid duplicate network calls.
- Country normalization: if “Gaza” appears and no country is inferred from metadata, default to `PS` (Palestine) to avoid mismatches (e.g., Mozambique’s Gaza province).

## Behavior
- LocalStorage caching remains at 7 days. First load populates cache; subsequent loads return instantly from cache.
- A small inter-article delay (100ms) remains to avoid rapid bursts, but overall request count is reduced, lowering perceived wait time.
- No change to other pages/components; all updates are internal to `src/utils/geocoding.js` used by the map.

## Nominatim Usage Notes
- Nominatim is a shared public service; please avoid high request rates. Reducing candidates and enabling caching lowers load.
- Consider adding server-side geocoding or using a paid geocoding provider for production scalability.

## Verification
- Map renders as before; markers and grouping remain unchanged.
- The app runs under the existing dev server. Caching + reduced candidates should noticeably improve first-load times and repeated loads.

## Latest Fixes
- Coordinate validation: `geocodeLocation` now validates `lat/lon` are finite numbers. Invalid responses return `null` and don’t propagate NaN.
- Marker guards: `WorldMap` skips marker creation when `lat/lng` are not finite, preventing `InvalidValueError: setPosition` in Google Maps.
- No UI changes: These are defensive measures to improve robustness without affecting other pages or visuals.