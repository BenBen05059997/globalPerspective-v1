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
  it('labels each string with its owner, strength and reason; a cut string says so', () => {
    setup();
    const labels = [...document.querySelectorAll('.board-label')].map((l) => l.textContent);
    expect(labels).toEqual(['Ours \u00B7 Inferred', 'Yours\u201Cmine\u201D', 'Yours \u00B7 Cut', 'Ours \u00B7 Medium']);
  });
  it('draws thickness from the strength of the string', () => {
    setup();
    const g = [...document.querySelectorAll('.board-string')];
    expect(g[3].getAttribute('data-strength')).toBe('medium');
    expect(g[0].getAttribute('data-strength')).toBe('inferred');
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

describe('graph parts that need data', () => {
  const rich = [
    { pinId: 'p01', kind: 'thread', refId: 'thread-a', addedAt: 'x', recordAvailable: true, born: new Date().toISOString().slice(0, 10), line: 'A one-line reading.', counts: { chapters: 3, liveBranches: 2, confirmedLinks: null } },
    { pinId: 'p02', kind: 'thread', refId: 'thread-b', addedAt: 'x' },
    { pinId: 'p03', kind: 'country', refId: 'IRN', addedAt: 'x' },
  ];
  const richInfo = { p01: { label: 'Hormuz', risk: 88, riskWas: 95, category: 'conflict' }, p02: { label: 'Talks', risk: 55, category: 'politics' }, p03: { label: 'Iran', risk: null } };
  const draw = (props) => render(<BoardGraph pins={rich} strings={[]} info={richInfo} selected={[]} pickedKey={null} onSelectPin={vi.fn()} onPickString={vi.fn()} onConnect={vi.fn()} {...props} />);

  it('writes the type line, the earlier score, the line and the counts on the card', () => {
    draw();
    const card = screen.getByRole('button', { name: /Hormuz/ });
    expect(card).toHaveTextContent('New this week');
    expect(card).toHaveTextContent('was 95');
    expect(card).toHaveTextContent('A one-line reading.');
    expect(card).toHaveTextContent('3 chapters \u00B7 2 live branches');
    expect(card.getAttribute('data-tier')).toBe('high');
    expect(screen.getByRole('button', { name: /Talks/ })).toHaveTextContent('Political \u00B7 Story');
    expect(screen.getByRole('button', { name: /Iran/ })).toHaveTextContent('Country');
  });
  it('leaves out what the data does not hold', () => {
    draw();
    const talks = screen.getByRole('button', { name: /Talks/ });
    expect(talks).not.toHaveTextContent('was');
    expect(talks).not.toHaveTextContent('New this week');
    expect(document.querySelector('[data-testid="board-fog"]')).toBeNull();
    expect(document.querySelector('.board-pin--ghost')).toBeNull();
  });
  it('draws a suggested pin that adds the actor, with a suggested string to each pin it touches', () => {
    const onAddGhost = vi.fn();
    draw({ ghosts: [{ name: 'oil price', pins: ['p01', 'p02'] }], onAddGhost });
    expect(document.querySelectorAll('.board-string--ghost .board-string__line')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Suggested pin: oil price/ }));
    expect(onAddGhost).toHaveBeenCalledWith('oil price');
    expect(screen.getByText('2 of your pins touch this')).toBeInTheDocument();
  });
  it('draws a failed combination and a day with no coverage', () => {
    draw({ failed: [{ a: 'p01', b: 'p03', text: 'No link found.' }], coverageGap: { date: '2026-10-14', note: 'no archive for that day' } });
    expect(screen.getByText('Combination failed')).toBeInTheDocument();
    expect(screen.getByText('No link found.')).toBeInTheDocument();
    expect(screen.getByTestId('board-fog')).toHaveTextContent('No coverage 14 Oct');
  });
  it('places pins joined by a string next to each other', () => {
    const six = [1, 2, 3, 4, 5, 6].map((n) => ({ pinId: `p0${n}`, kind: 'thread', refId: `t${n}`, addedAt: 'x' }));
    const gapOf = (strings) => {
      cleanup();
      render(<BoardGraph pins={six} strings={strings} info={{}} selected={[]} pickedKey={null} onSelectPin={vi.fn()} onPickString={vi.fn()} onConnect={vi.fn()} />);
      const at = (id) => { const o = document.querySelector(`[data-pin-id="${id}"]`).parentElement; return [Number(o.getAttribute('x')), Number(o.getAttribute('y'))]; };
      return Math.hypot(at('p01')[0] - at('p04')[0], at('p01')[1] - at('p04')[1]);
    };
    expect(gapOf([{ a: 'p01', b: 'p04', owner: 'yours' }])).toBeLessThan(gapOf([]) * 0.8);
  });
});
