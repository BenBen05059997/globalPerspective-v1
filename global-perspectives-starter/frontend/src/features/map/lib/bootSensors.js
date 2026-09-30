// bootSensors — the boot screen's three sensors, derived ONLY from data that really arrived.
// Nothing here looks at a clock: a sensor is 'ok' when its data is in hand, 'fail' when its load
// ended without it, and 'wait' until one of those is true.
//
//   News desk       the stories feed (useGeminiTopics) finished, and did not fail empty-handed
//   Disaster alerts the world bundle (world/latest.json) arrived carrying a checked GDACS source
//   Map             the globe / radar really drew its first frame

export const BOOT_SENSOR_LABELS = { news: 'News desk', disaster: 'Disaster alerts', map: 'Map' };

/** The three sensors, all waiting: the state before anything has arrived (also the Suspense fallback). */
export const WAITING_SENSORS = [
  { id: 'news', label: BOOT_SENSOR_LABELS.news, state: 'wait' },
  { id: 'disaster', label: BOOT_SENSOR_LABELS.disaster, state: 'wait' },
  { id: 'map', label: BOOT_SENSOR_LABELS.map, state: 'wait' },
];

export function deriveBootSensors({ topics, topicsSettled, topicsError, world, worldLoading, worldError, mapDrawn, mapFailed }) {
  let news = 'wait';
  if (topicsSettled) news = (topicsError && !(topics && topics.length)) ? 'fail' : 'ok';

  let disaster = 'wait';
  if (world) disaster = world.sources?.gdacs ? 'ok' : 'fail';     // bundle here, GDACS never checked
  else if (worldError || !worldLoading) disaster = 'fail';         // errored, or no bundle exists (404)

  let map = 'wait';
  if (mapDrawn) map = 'ok';
  else if (mapFailed) map = 'fail';

  return [
    { id: 'news', label: BOOT_SENSOR_LABELS.news, state: news },
    { id: 'disaster', label: BOOT_SENSOR_LABELS.disaster, state: disaster },
    { id: 'map', label: BOOT_SENSOR_LABELS.map, state: map },
  ];
}
