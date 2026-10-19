// Shared primitives (2026-10-19): Button, Tabs, Card, Chip, Tooltip — behaviour, a11y and the CSS rules
// (tokens only, one accent-outline "selected" style, 44px tap targets).
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Button from '@/shared/ui/Button.jsx';
import Tabs, { tabIds, tabPanelProps } from '@/shared/ui/Tabs.jsx';
import Card from '@/shared/ui/Card.jsx';
import Chip from '@/shared/ui/Chip.jsx';
import Tooltip, { placeTooltip, TIP_WIDTH } from '@/shared/ui/Tooltip.jsx';
import StoryPeek from '@/shared/ui/StoryPeek.jsx';
import TierChip from '@/shared/ui/TierChip.jsx';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.resolve(HERE, '../primitives.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('Button', () => {
  it('renders a <button type=button> by default, quiet variant', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const b = screen.getByRole('button', { name: 'Save' });
    expect(b).toHaveAttribute('type', 'button');
    expect(b.className).toBe('gp-btn gp-btn--quiet');
    expect(b).not.toHaveAttribute('aria-pressed');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledOnce();
  });
  it('router link with `to`, plain link with `href`', () => {
    render(<MemoryRouter><Button to="/map" variant="primary">Open map</Button><Button href="https://x.test/a">Ext</Button></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Open map' })).toHaveAttribute('href', '/map');
    expect(screen.getByRole('link', { name: 'Open map' }).className).toContain('gp-btn--primary');
    expect(screen.getByRole('link', { name: 'Ext' })).toHaveAttribute('href', 'https://x.test/a');
  });
  it('icon variant takes its name from `label`; selected sets aria-pressed + the selected class', () => {
    const { rerender } = render(<Button variant="icon" label="Close">×</Button>);
    expect(screen.getByRole('button', { name: 'Close' }).className).toContain('gp-btn--icon');
    rerender(<Button selected compact>Map</Button>);
    const b = screen.getByRole('button', { name: 'Map' });
    expect(b).toHaveAttribute('aria-pressed', 'true');
    expect(b.className).toContain('gp-btn--selected');
    expect(b.className).toContain('gp-btn--compact');
    rerender(<Button selected={false}>Map</Button>);
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Tabs', () => {
  const TABS = [{ key: 'a', label: 'All', count: 12 }, { key: 'b', label: 'Busy' }, { key: 'c', label: 'Calm' }];
  it('line variant: a tablist with aria-selected, roving tabindex and panel ids', () => {
    render(<Tabs tabs={TABS} active="b" onChange={() => {}} label="Sections" idBase="s" />);
    expect(screen.getByRole('tablist', { name: 'Sections' }).className).toContain('gp-tabs--line');
    const b = screen.getByRole('tab', { name: 'Busy' });
    expect(b).toHaveAttribute('aria-selected', 'true');
    expect(b).toHaveAttribute('aria-controls', tabIds('s', 'b').panel);
    expect(screen.getByRole('tab', { name: /All/ })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByText('12')).toHaveClass('gp-tabs__count');
    expect(tabPanelProps('s', 'b')).toMatchObject({ id: 's-panel-b', role: 'tabpanel', 'aria-labelledby': 's-tab-b' });
  });
  it('arrow keys wrap, Home / End jump, click selects', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} active="c" onChange={onChange} label="S" idBase="s" />);
    const list = screen.getByRole('tablist');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('a');
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('b');
    fireEvent.keyDown(list, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('a');
    fireEvent.keyDown(list, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('c');
    fireEvent.click(screen.getByRole('tab', { name: 'Busy' }));
    expect(onChange).toHaveBeenLastCalledWith('b');
  });
  it('segmented variant is a radiogroup with aria-checked (no panels)', () => {
    render(<Tabs variant="segmented" tabs={TABS} active="a" onChange={() => {}} label="View" idBase="v" />);
    expect(screen.getByRole('radiogroup', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /All/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Calm' })).not.toHaveAttribute('aria-controls');
  });
  it('phone variant sets the column count', () => {
    render(<Tabs variant="phone" tabs={TABS} active="a" onChange={() => {}} label="P" idBase="p" />);
    expect(screen.getByRole('tablist').style.getPropertyValue('--tabs-n')).toBe('3');
  });
});

describe('Card', () => {
  it('panel ladder level, padding, selected, element', () => {
    const { container, rerender } = render(<Card>x</Card>);
    expect(container.firstChild.className).toBe('gp-card gp-card--1');
    expect(container.firstChild.tagName).toBe('DIV');
    rerender(<Card level={2} pad="sm" selected as="section" aria-label="Box">x</Card>);
    expect(container.firstChild.tagName).toBe('SECTION');
    expect(container.firstChild.className).toBe('gp-card gp-card--2 gp-card--pad-sm gp-card--selected');
    rerender(<Card level="hud">x</Card>);
    expect(container.firstChild.className).toContain('gp-card--hud');
  });
});

describe('Chip', () => {
  it('is a toggle button with aria-pressed, optional count and dot', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Chip onClick={onClick}>Conflict</Chip>);
    const c = screen.getByRole('button', { name: 'Conflict' });
    expect(c).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(c);
    expect(onClick).toHaveBeenCalledOnce();
    rerender(<Chip selected count={4} dot="var(--hue-conflict)">Conflict</Chip>);
    const s = screen.getByRole('button', { name: /Conflict/ });
    expect(s).toHaveAttribute('aria-pressed', 'true');
    expect(s.className).toContain('gp-chip--selected');
    expect(s.style.getPropertyValue('--chip-dot')).toBe('var(--hue-conflict)');
    expect(screen.getByText('4')).toHaveClass('gp-chip__count');
  });
});

describe('Tooltip', () => {
  it('renders the given lines only, as role=tooltip', () => {
    render(<Tooltip id="t1" kicker="Conflict" dot="var(--hue-conflict)" title="Strait tensions" meta={['Iran', null, '4 sources']} />);
    const t = screen.getByRole('tooltip');
    expect(t).toHaveAttribute('id', 't1');
    expect(t.querySelector('.gp-tip__meta').textContent).toBe('Iran4 sources');
    expect(t.querySelector('.gp-tip__note')).toBeNull();
    expect(t.querySelector('.gp-tip__hint')).toBeNull();
  });
  it('placeTooltip: right of the point, flips left at the edge, clamps inside bounds', () => {
    const bounds = { width: 1000, height: 600 };
    expect(placeTooltip({ x: 100, y: 300 }, { bounds })).toEqual({ left: 112, top: 230 });
    expect(placeTooltip({ x: 900, y: 300 }, { bounds }).left).toBe(900 - 12 - TIP_WIDTH);
    expect(placeTooltip({ x: 100, y: 10 }, { bounds }).top).toBe(8);
    expect(placeTooltip({ x: 100, y: 595 }, { bounds }).top).toBe(600 - 140 - 8);
  });
  it('`at` positions the card absolutely inside its container', () => {
    render(<Tooltip title="Marker" at={{ x: 100, y: 300 }} bounds={{ width: 1000, height: 600 }} />);
    const { style } = screen.getByRole('tooltip');
    expect(style.position).toBe('absolute');
    expect(style.left).toBe('112px');
  });
  it('StoryPeek is the Tooltip fed from peekData()', () => {
    render(<StoryPeek id="peek-1" style={{ position: 'fixed', top: 1, left: 2 }} data={{ category: 'Conflict', hue: 'var(--hue-conflict)', headline: 'H', primaryCountry: 'Iran', sourcesLabel: '3 sources', updatedLabel: 'updated 2h ago', hint: 'Click to open' }} />);
    const t = screen.getByRole('tooltip');
    expect(t.className).toBe('gp-tip');
    expect(t).toHaveTextContent('Conflict');
    expect(t).toHaveTextContent('updated 2h ago');
    expect(t.style.position).toBe('fixed');
  });
});

describe('TierChip reads the neutral tier tokens only', () => {
  it('has no hue prop path: an unknown `hue` never reaches the element', () => {
    const { container } = render(<TierChip tier="high" hue="#ff0000" />);
    expect(container.firstChild.getAttribute('style')).toBeNull();
    const tierCss = fs.readFileSync(path.resolve(HERE, '../TierChip.css'), 'utf8');
    expect(tierCss).not.toMatch(/chip-hue/);
    for (const t of ['low', 'moderate', 'elevated', 'high']) expect(tierCss).toMatch(new RegExp(`\\.gp-tier--${t} \\{ --tier-ring: var\\(--tier-${t}\\)`));
  });
});

describe('primitives.css', () => {
  it('uses tokens only: no colour literals, no fills on selected', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    const selected = css.match(/\.gp-(btn|chip)--selected[^{]*\{[^}]*\}/g) || [];
    expect(selected).toHaveLength(2);
    for (const rule of selected) {
      expect(rule).toMatch(/border-color: var\(--accent\)/);
      expect(rule).not.toMatch(/background/);
    }
  });
  it('controls keep a 44px target (compact sizes only on fine pointers)', () => {
    expect(css).toMatch(/\.gp-btn \{[^}]*min-height: var\(--tap-min\)/);
    expect(css).toMatch(/\.gp-tabs__tab \{[^}]*min-height: var\(--tap-min\)/);
    expect(css).toMatch(/@media \(pointer: coarse\) \{\s*\.gp-btn--compact \{ min-height: var\(--tap-min\)/);
    expect(css).toMatch(/@media \(pointer: coarse\) \{ \.gp-chip \{ min-height: var\(--tap-min\)/);
  });
});
