// crisisHue — re-exported from shared/lib (StoryPeek/peekData are shared and eslint's
// dependency-direction rule forbids shared/ importing features/, so the canonical pure mapping
// lives in shared/lib/crisisHue.js; this file just keeps the map feature's original import path
// working, since the console (features/map) is the natural home for a crisis-hue concept).
export * from '@/shared/lib/crisisHue.js';
