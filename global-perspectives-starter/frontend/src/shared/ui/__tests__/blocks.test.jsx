import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StatusGlyph from '@/shared/ui/StatusGlyph.jsx';
import TierChip from '@/shared/ui/TierChip.jsx';
import StoryRow from '@/shared/ui/StoryRow.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import FilterGroup from '@/shared/ui/FilterGroup.jsx';
import { ageShortFrom } from '@/shared/lib/age.js';

const NOW = Date.parse('2026-10-01T12:00:00Z');
const ago = (days) => new Date(NOW - days * 86400000).toISOString();

describe('StatusGlyph', () => {
  it('renders the legend glyph for each key with an accessible name', () => {
    const want = { escalating: '▲', new: '●', steady: '◆', cooling: '▼' };
    for (const [k, g] of Object.entries(want)) {
      const { unmount } = render(<StatusGlyph status={k} />);
      expect(screen.getByRole('img', { name: k })).toHaveTextContent(g);
      unmount();
    }
  });
  it('derives from a tracker record and renders nothing for closed/unknown', () => {
    const { container, rerender } = render(<StatusGlyph situation={{ state: 'emerging' }} />);
    expect(screen.getByRole('img', { name: 'new' })).toBeInTheDocument();
    rerender(<StatusGlyph situation={{ state: 'closed' }} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<StatusGlyph />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TierChip', () => {
  it('shows the tier word, and the number only when the data has one', () => {
    const { rerender } = render(<TierChip tier="high" score={82.4} />);
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    rerender(<TierChip tier="elevated" />);
    expect(screen.getByText('Elevated')).toBeInTheDocument();
    expect(screen.queryByText(/\d/)).toBeNull();
    rerender(<TierChip tier="low" score={null} />);
    expect(screen.queryByText(/\d/)).toBeNull();
  });
  it('has a distinct not-scored state and never invents a tier', () => {
    const { container, rerender } = render(<TierChip tier={null} score={70} />);
    expect(container.firstChild).toHaveAttribute('data-tier', 'none');
    expect(screen.getByText('Not scored')).toBeInTheDocument();
    expect(screen.queryByText('70')).toBeNull();
    rerender(<TierChip tier="bogus" />);
    expect(container.firstChild).toHaveAttribute('data-tier', 'none');
  });
  it('marks the tier as a ring-weight class per tier', () => {
    for (const t of ['low', 'moderate', 'elevated', 'high']) {
      const { container, unmount } = render(<TierChip tier={t} />);
      expect(container.firstChild.className).toContain(`gp-tier--${t}`);
      unmount();
    }
  });
  it('CSS has no fill colour per tier (outline + weight only)', () => {
    const css = fs.readFileSync(path.resolve(HERE, '../TierChip.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/background/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(css).toMatch(/\.gp-tier--high[^}]*border-width: 2px/);
  });
});

describe('StoryRow', () => {
  const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
  it('as a router link: the whole row is one <a>', () => {
    wrap(<StoryRow to="/thread/abc" title="Strait tensions" place="Iran" crisis="conflict" tier="high" status="escalating" changedAt={ago(0.1)} now={NOW} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/thread/abc');
    expect(link).toHaveTextContent('Strait tensions');
    expect(link).toHaveTextContent('Iran');
    expect(link).toHaveTextContent('High');
    expect(link.querySelector('[role=img]')).toHaveAttribute('aria-label', 'escalating');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
  it('as a button: onClick fires; href gives a plain anchor', () => {
    const onClick = vi.fn();
    const { unmount } = wrap(<StoryRow onClick={onClick} title="T" />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    unmount();
    wrap(<StoryRow href="https://example.org/x" title="T" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.org/x');
  });
  it('age is amber only when the last change is older than 7 days; hidden when there is no timestamp', () => {
    const { container, rerender } = wrap(<StoryRow onClick={() => {}} title="T" changedAt={ago(3)} now={NOW} />);
    expect(container.querySelector('.gp-row__age')).toHaveTextContent('3d');
    expect(container.querySelector('.gp-row__age')).toHaveAttribute('data-fresh', 'ok');
    rerender(<MemoryRouter><StoryRow onClick={() => {}} title="T" changedAt={ago(12)} now={NOW} /></MemoryRouter>);
    expect(container.querySelector('.gp-row__age')).toHaveAttribute('data-fresh', 'older');
    expect(container.querySelector('.gp-row__age')).toHaveTextContent('12d');
    rerender(<MemoryRouter><StoryRow onClick={() => {}} title="T" /></MemoryRouter>);
    expect(container.querySelector('.gp-row__age')).toBeNull();
  });
  it('crisis bar uses the hue token; explicit hue wins; unscored rows show "Not scored"', () => {
    const { container, rerender } = wrap(<StoryRow onClick={() => {}} title="T" crisis="economic" />);
    expect(container.querySelector('.gp-row').style.getPropertyValue('--row-hue')).toBe('var(--hue-economic)');
    expect(screen.getByText('Not scored')).toBeInTheDocument();
    rerender(<MemoryRouter><StoryRow onClick={() => {}} title="T" crisis="economic" hue="#123456" /></MemoryRouter>);
    expect(container.querySelector('.gp-row').style.getPropertyValue('--row-hue')).toBe('#123456');
  });
  it('StoryPeek opens from hover/focus via the shared usePeek hook shape', () => {
    const peek = { openId: null, style: {}, openOnHover: vi.fn(), openOnFocus: vi.fn(), close: vi.fn() };
    const data = { headline: 'Peek headline', hint: 'Click to open the story card' };
    const { rerender } = wrap(<StoryRow id="r1" onClick={() => {}} title="T" peek={peek} peekData={data} />);
    const btn = screen.getByRole('button');
    fireEvent.mouseEnter(btn); expect(peek.openOnHover).toHaveBeenCalledWith('r1', btn);
    fireEvent.focus(btn); expect(peek.openOnFocus).toHaveBeenCalledWith('r1', btn);
    fireEvent.blur(btn); expect(peek.close).toHaveBeenCalled();
    expect(screen.queryByRole('tooltip')).toBeNull();
    rerender(<MemoryRouter><StoryRow id="r1" onClick={() => {}} title="T" peek={{ ...peek, openId: 'r1' }} peekData={data} /></MemoryRouter>);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Peek headline');
    expect(screen.getByRole('button')).toHaveAttribute('aria-describedby', 'peek-r1');
  });
  it('age helper', () => {
    expect(ageShortFrom(ago(0.01), NOW)).toBe('14m');
    expect(ageShortFrom(ago(0.25), NOW)).toBe('6h');
    expect(ageShortFrom('nope', NOW)).toBe('');
  });
});

describe('SectionHeader', () => {
  it('renders label, hint and count; count only when given', () => {
    const { rerender } = render(<SectionHeader label="Moving now" hint="last 7 days" count={4} />);
    expect(screen.getByRole('heading', { name: /Moving now/ })).toHaveTextContent('· 4');
    expect(screen.getByText('last 7 days')).toBeInTheDocument();
    rerender(<SectionHeader label="Archive" />);
    expect(screen.getByRole('heading')).not.toHaveTextContent('·');
  });
});

describe('FilterGroup', () => {
  const opts = [{ value: 'a', label: 'Alpha', count: 3 }, { value: 'b', label: 'Beta' }];
  it('checkbox group: labelled fieldset, toggles values', () => {
    const onChange = vi.fn();
    render(<FilterGroup label="Crisis type" options={opts} value={['a']} onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'Crisis type' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Alpha/)).toBeChecked();
    fireEvent.click(screen.getByLabelText('Beta'));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    fireEvent.click(screen.getByLabelText(/Alpha/));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
  it('radio group: one choice', () => {
    const onChange = vi.fn();
    render(<FilterGroup label="Window" type="radio" options={opts} value="a" onChange={onChange} />);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByLabelText(/Alpha/)).toBeChecked();
    fireEvent.click(screen.getByLabelText('Beta'));
    expect(onChange).toHaveBeenCalledWith('b');
  });
  it('rows are 44px targets (CSS) and the blocks CSS holds no colour literals', () => {
    const css = fs.readFileSync(path.resolve(HERE, '../blocks.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/\.gp-filter__opt[^}]*min-height: var\(--tap-min\)/);
    expect(css).toMatch(/\.gp-row__link[^}]*min-height: var\(--tap-min\)/);
    expect(css).toMatch(/focus-visible[^}]*--focus-ring/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});
