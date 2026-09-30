// staticBoot — handoff from the pre-JS boot screen (index.html) to React. index.html injects a
// `#gp-boot` node so the first paint is the boot screen, not a blank page; the first React commit
// removes it. React's own BootLoader never carries that id, so this can only ever remove the
// static node. Safe to call any number of times.
export const STATIC_BOOT_ID = 'gp-boot';

// True from the moment the FULL (`/`) pre-JS boot was taken over until the console opens: the
// visitor has been looking at the boot screen since page load, so the "slow network" note counts
// from load, not from the moment React mounted.
let fullBootInProgress = false;

export function removeStaticBoot() {
  if (typeof document === 'undefined') return;
  const node = document.getElementById(STATIC_BOOT_ID);
  if (!node) return;
  if (node.classList.contains('gp-boot--full')) fullBootInProgress = true;
  node.remove();
}

/** ms the visitor has already waited on the full boot screen (0 when this isn't that boot). */
export function bootWaitedMs() {
  return fullBootInProgress && typeof performance !== 'undefined' ? performance.now() : 0;
}

/** The console opened: later loaders start their own clock again. */
export function endFullBoot() { fullBootInProgress = false; }
