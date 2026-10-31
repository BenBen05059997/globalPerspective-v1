// DEV/TEST ONLY. A board that differs from ours in all three ways, for DivergencePanel and its tests.
export const divergenceBoard = {
  boardId: 'dev-divergence', uid: 'dev', name: 'Gulf and the Horn',
  pins: [
    { pinId: 'p01', kind: 'thread', refId: 'story-a' },
    { pinId: 'p02', kind: 'thread', refId: 'story-b' },
    { pinId: 'p03', kind: 'country', refId: 'EGY' },
  ],
  strings: [
    { a: 'p01', b: 'p02', owner: 'ours', strength: 'inferred', cutAt: '2026-10-20T09:00:00Z' },
    { a: 'p02', b: 'p03', owner: 'yours', keptAt: '2026-10-21T09:00:00Z', line: 'Both are Egypt’s periphery; watch Cairo' },
  ],
  weights: { f1: { 'f1-1': 0.7 } },
  dismissed: [], summary: { versions: [] }, createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-21T00:00:00Z',
};

export const divergenceStories = {
  'story-a': { forks: [{ forkId: 'f1', drawnAt: '2026-10-19', branches: [
    { branchId: 'f1-1', text: 'Selective coercion', p: 55, verdict: null },
    { branchId: 'f1-2', text: 'Reopening', p: 30, verdict: null },
    { branchId: 'f1-3', text: 'Closure', p: 15, verdict: null },
  ] }] },
};

export const divergenceLabels = { p01: 'Ship attacks near Hormuz', p02: 'Sudan gold-mine airstrikes', p03: 'Egypt' };
