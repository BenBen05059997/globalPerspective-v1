// threadPath — the story address, now built by shared/lib/links.js (storyHref). Kept as a thin re-export
// for its existing callers; new code imports storyHref from '@/shared/lib/links.js'.
export { storyHref as threadPath } from '@/shared/lib/links.js';
