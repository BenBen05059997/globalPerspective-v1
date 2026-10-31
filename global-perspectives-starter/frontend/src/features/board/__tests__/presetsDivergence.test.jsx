import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import PresetsPanel from '../components/PresetsPanel.jsx';
import PinBudget from '../components/PinBudget.jsx';
import DivergencePanel from '../components/DivergencePanel.jsx';
import FoldingRules from '../components/FoldingRules.jsx';
import { divergenceBoard, divergenceStories, divergenceLabels } from '../dev/divergenceFixture.js';
import { setWeight, forkWeights, weightGap } from '../lib/divergence.js';
import { isOldNode, isDeadBranch, strongestArrivals } from '../lib/folding.js';

afterEach(cleanup);
const preset = { presetId: 'r-gulf', name: 'Gulf: highest-risk stories', pins: [{ pinId: 'p01' }, { pinId: 'p02' }], strings: [{ a: 'p01', b: 'p02' }] };
const labelOf = (id) => divergenceLabels[id];

it('preset card: tag, counts, fork, footer sentence', () => {
  const onFork = vi.fn();
  render(<MemoryRouter><PresetsPanel presets={[preset]} canFork onFork={onFork} signInHref="/x" /></MemoryRouter>);
  expect(screen.getByText('Ours · read-only')).toBeInTheDocument();
  expect(screen.getByText('2 pins · 1 string')).toBeInTheDocument();
  expect(screen.getByText(/Forking makes a copy that is yours/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Fork Gulf: highest-risk stories' }));
  expect(onFork).toHaveBeenCalledWith(preset);
});
it('signed out shows sign in to fork', () => {
  render(<MemoryRouter><PresetsPanel presets={[preset]} canFork={false} signInHref="/x" /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Sign in to fork' })).toBeInTheDocument();
});
it('pin budget has a label and 12 segments', () => {
  const { container } = render(<PinBudget used={7} />);
  expect(screen.getByRole('img', { name: 'Pin budget 7 of 12' })).toBeInTheDocument();
  expect(container.querySelectorAll('.pin-budget__seg--on')).toHaveLength(7);
  expect(container.querySelectorAll('.pin-budget__seg')).toHaveLength(12);
});
it('divergence panel shows cut, weights and own line; restore and weight write out', () => {
  const onRestore = vi.fn(); const onWeight = vi.fn();
  render(<DivergencePanel board={divergenceBoard} stories={divergenceStories} labelOf={labelOf} onRestore={onRestore} onWeight={onWeight} />);
  expect(screen.getByText(/cut by you 20 Oct/)).toBeInTheDocument();
  expect(screen.getByText(/Both are Egypt/)).toBeInTheDocument();
  expect(screen.getByText('Nobody else sees this view.', { exact: false })).toBeInTheDocument();
  expect(screen.getByLabelText('Your weight for Selective coercion, percent')).toHaveValue(70);
  expect(screen.getByText(/Largest gap 15 points/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Your weight for Reopening, percent'), { target: { value: '25' } });
  expect(onWeight).toHaveBeenCalledWith('f1', 'f1-2', 25);
  fireEvent.click(screen.getByRole('button', { name: /^Restore/ }));
  expect(onRestore).toHaveBeenCalledWith('p01', 'p02');
});
it('divergence panel is absent when nothing differs', () => {
  const { container } = render(<DivergencePanel board={{ ...divergenceBoard, strings: [], pins: [] }} stories={{}} labelOf={labelOf} />);
  expect(container.textContent).toBe('');
});
it('setWeight stores 0..1, clamps, clears', () => {
  let b = setWeight(divergenceBoard, 'f1', 'f1-2', 25);
  expect(b.weights.f1['f1-2']).toBe(0.25);
  expect(setWeight(b, 'f1', 'f1-2', 400).weights.f1['f1-2']).toBe(1);
  const cleared = setWeight(setWeight(divergenceBoard, 'f1', 'f1-1', null), 'f1', 'zz', null);
  expect(cleared.weights).toEqual({});
  expect(weightGap(forkWeights(divergenceBoard, divergenceStories)[0])).toBe(15);
});
it('folding rules: thresholds', () => {
  const now = Date.parse('2026-10-31');
  expect(isOldNode('2026-09-30', now)).toBe(true);
  expect(isOldNode('2026-10-10', now)).toBe(false);
  expect(isOldNode(null, now)).toBe(false);
  expect(isDeadBranch({ p: 19 })).toBe(true);
  expect(isDeadBranch({ p: 20 })).toBe(false);
  expect(isDeadBranch({ p: null })).toBe(false);
  const arr = ['weak', 'strong', 'medium', 'weak', 'strong', 'medium', 'weak'].map((strength, i) => ({ i, strength }));
  const { shown, hidden } = strongestArrivals(arr);
  expect(shown.map((a) => a.strength)).toEqual(['strong', 'strong', 'medium', 'medium', 'weak']);
  expect(hidden).toBe(2);
});
it('folding page lists the rules', () => {
  render(<FoldingRules />);
  expect(screen.getByText('What folds')).toBeInTheDocument();
  expect(screen.getByText('A branch under 20%')).toBeInTheDocument();
  expect(screen.getByText('Folded is the default at every level')).toBeInTheDocument();
  expect(screen.getByText('Linkurious / Ogma')).toBeInTheDocument();
});
