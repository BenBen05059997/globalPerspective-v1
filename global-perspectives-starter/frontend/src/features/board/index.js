// Public API of the board feature. The page itself is lazy-loaded by path in app/App.jsx (its own chunk), so
// nothing here may import it. The shell uses `boardAvailable` to show the nav link only where a board exists.
export { boardAvailable } from '@/features/board/lib/boardApi.js';
