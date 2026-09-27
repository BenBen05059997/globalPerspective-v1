// imported by Node tooling outside src/ — keep relative imports
// Studio deck stacking state (S5c F2 "+ Add analysis" / F3 DECK|BOARD). A "case" is one
// frozen selection of stories; each successful run on that SAME selection becomes a new
// SECTION stacked onto the case — never a re-fetch (AnalysisStudio.jsx's context cache is
// keyed by the selection, so adding a section is compute-only). Pure — no React here.

// addSection(sections, section) -> new array with `section` appended. Never mutates.
export function addSection(sections, section) {
  return [...(Array.isArray(sections) ? sections : []), section];
}

export function clearSections() {
  return [];
}

export const VIEW_MODES = ['deck', 'board'];

// toggleView(view) -> the other view. Board is desktop-only (F3: "off on phones") —
// the caller is responsible for never rendering 'board' below the phone breakpoint.
export function toggleView(view) {
  return view === 'board' ? 'deck' : 'board';
}

// nextFocusId(sections, currentId) -> the id to focus in BOARD view after `sections`
// changes (e.g. a new section was added) — always the newest section, so "+ Add
// analysis" naturally brings its own result to the front of the board.
export function nextFocusId(sections) {
  const list = Array.isArray(sections) ? sections : [];
  return list.length ? list[list.length - 1].id : null;
}
