// The one door the board hooks call: the real newsBoard Function URL when window.BOARD_ENDPOINT is set, the
// in-memory dev fake when it is not and this is a dev build, otherwise "not available". The fake is a dynamic
// import behind import.meta.env.DEV, so a production build drops it entirely.
import { boardAction, boardConfigured } from '@/shared/api/restProxy';

export const DEV_MEMBER_KEY = 'gp_dev_board';

/** True in a dev build opened with ?devBoard=1 (remembered for the tab): the page acts as a signed-in member. */
export function devMember() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('devBoard') === '1') sessionStorage.setItem(DEV_MEMBER_KEY, '1');
    return sessionStorage.getItem(DEV_MEMBER_KEY) === '1';
  } catch { return false; }
}

/** Whether any board backend exists here (the real one, or the dev fake in a dev build). */
export function boardAvailable() {
  return boardConfigured() || !!import.meta.env.DEV;
}

/** callBoard(action, body, { auth }) -> the reply's data. Throws an Error (with status / code / budget) on failure. */
export async function callBoard(action, body = {}, opts = {}) {
  if (boardConfigured()) return boardAction(action, body, opts);
  if (import.meta.env.DEV) {
    const fake = await import('../dev/fakeBoardApi.js');
    return fake.fakeBoardAction(action, body);
  }
  throw new Error('The board is not available yet.');
}
