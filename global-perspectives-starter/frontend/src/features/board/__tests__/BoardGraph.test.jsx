import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BoardGraph from '@/features/board/components/BoardGraph.jsx';

afterEach(cleanup);

const pins = [
  { pinId: 'p01', kind: 'thread', refId: 'thread-a', addedAt: 'x' },
  { pinId: 'p02', kind: 'thread', refId: 'thread-b', addedAt: 'x' },
  { pinId: 'p03', kind: 'country', refId: 'IRN', addedAt: 'x' },
  { pinId: 'p04', kind: 'actor', refId: 'Iran', addedAt: 'x' },
];
const info = {
  p01: { label: 'Hormuz shipping', risk: 62 }, p02: { label: 'Gulf talks', risk: null },
  p03: { label: 'Iran', risk: null }, p04: { label: 'Iran', risk: null },
};
const strings = [
  { a: 'p01', b: 'p02', owner: 'ours', strength: 'inferred' },
  { a: 'p01', b: 'p03', owner: 'yours', line: 'mine' },
  { a: 'p02', b: 'p03', owner: 'yours', cutAt: '2026-10-20T00:00:00Z' },
  { a: 'p01', b: 'p04', owner: 'ours', strength: 'medium' },
];
const setup = (props = {}) => render(
  <BoardGraph pins={pins} strings={strings} info={info} selected={[]} pickedKey={null} onSelectPin={vi.fn()} onPickString={vi.fn()} onConnect={vi.fn()} {...props} />,
);
const textureOf = (a, b) => [...document.querySelectorAll('.board-string')].find((g, i) => `${strings[i].a}${strings[i].b}` === `${a}${b}`).getAttribute('data-texture');

describe('string texture', () => {
  it('draws ours inferred dashed, yours dashed-alt, a cut string cut, and ours confirmed solid', () => {
    setup();
    expect(textureOf('p01', 'p02')).toBe('dashed');
    expect(textureOf('p01', 'p03')).toBe('dashed-alt');
    expect(textureOf('p02', 'p03')).toBe('cut');
    expect(textureOf('p01', 'p04')).toBe('solid');
  });
  it('labels ours "inferred", yours "yours" and a cut string "cut"; a solid one carries no tag', () => {
    setup();
    const tags = [...document.querySelectorAll('.board-string__tag')].map((t) => t.textContent);
    expect(tags).toEqual(['inferred', 'yours', 'cut']);
  });
});

describe('pins', () => {
  it('shows the title, the kind, and risk as a tier word plus the number only where a risk exists', () => {
    setup();
    expect(screen.getByRole('button', { name: /Story: Hormuz shipping, risk 62/ })).toBeInTheDocument();
    expect(screen.getByText('Elevated')).toBeInTheDocument();
    expect(screen.queryAllByText('Not scored')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Story: Gulf talks' })).toBeInTheDocument();
  });
  it('selects a pin on click and on Enter', () => {
    const onSelectPin = vi.fn();
    setup({ onSelectPin });
    const pin = screen.getByRole('button', { name: /Hormuz/ });
    fireEvent.click(pin);
    fireEvent.keyDown(pin, { key: 'Enter' });
    expect(onSelectPin).toHaveBeenCalledTimes(2);
    expect(onSelectPin).toHaveBeenCalledWith('p01');
  });
  it('connects when one pin is dragged onto another', () => {
    const onConnect = vi.fn();
    setup({ onConnect });
    const from = screen.getByRole('button', { name: /Hormuz/ });
    const to = screen.getByRole('button', { name: /Gulf talks/ });
    document.elementFromPoint = vi.fn(() => to);
    const svg = document.querySelector('svg.board-svg');
    fireEvent.pointerDown(from, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(svg, { clientX: 80, clientY: 90 });
    fireEvent.pointerUp(svg, { clientX: 80, clientY: 90 });
    expect(onConnect).toHaveBeenCalledWith('p01', 'p02');
    fireEvent.click(from); // the click after a drag is not a selection
  });
  it('a press with no movement is a click, not a connect', () => {
    const onConnect = vi.fn();
    setup({ onConnect });
    const from = screen.getByRole('button', { name: /Hormuz/ });
    fireEvent.pointerDown(from, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerUp(document.querySelector('svg.board-svg'), { clientX: 10, clientY: 10 });
    expect(onConnect).not.toHaveBeenCalled();
  });
});

it('says so when there are no pins', () => {
  render(<BoardGraph pins={[]} strings={[]} info={{}} selected={[]} pickedKey={null} onSelectPin={vi.fn()} onPickString={vi.fn()} onConnect={vi.fn()} />);
  expect(screen.getByText(/No pins yet/)).toBeInTheDocument();
});
