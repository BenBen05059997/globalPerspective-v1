// Public API of the board feature. The page itself is lazy-loaded by path in app/App.jsx (its own chunk), so
// nothing here may import it. The shell uses `boardAvailable` to show the nav link only where a board exists.
export { boardAvailable } from '@/features/board/lib/boardApi.js';
// The story page's "Open the story's board": which theme board holds a story (index/themes.json, a public read).
export { useThemes } from '@/features/board/hooks/useThemes.js';
export { boardOfStory } from '@/features/board/lib/linkedBoard.js';
