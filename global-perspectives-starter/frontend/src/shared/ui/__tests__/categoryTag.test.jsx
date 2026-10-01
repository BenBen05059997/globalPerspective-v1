import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('CategoryTag', () => {
  it('renders the category word with a dot hint and no fill', () => {
    render(<CategoryTag category="conflict" />);
    const el = screen.getByText('conflict');
    expect(el.className).toContain('gp-cat');
    expect(el.style.getPropertyValue('--cat-dot')).toBe('var(--hue-conflict)');
  });
  it('dot = crisis hue of the topic mapping, never a topic palette', () => {
    const { rerender } = render(<CategoryTag category="disaster" />);
    expect(screen.getByText('disaster').style.getPropertyValue('--cat-dot')).toBe('var(--hue-humanitarian)');
    rerender(<CategoryTag category="energy" />);
    expect(screen.getByText('energy').style.getPropertyValue('--cat-dot')).toBe('var(--hue-economic)');
    rerender(<CategoryTag category="technology" />);
    const el = screen.getByText('technology');
    expect(el.style.getPropertyValue('--cat-dot')).toBe('');
    expect(el.getAttribute('data-dot')).toBe('off');
  });
  it('renders nothing without a category', () => {
    const { container } = render(<CategoryTag category="" />);
    expect(container.firstChild).toBeNull();
  });
  it('keeps unknown categories as plain tags (no dot colour invented)', () => {
    render(<CategoryTag category="weirdtopic" />);
    expect(screen.getByText('weirdtopic').style.getPropertyValue('--cat-dot')).toBe('');
  });
  it('the CSS paints the tag with tokens only', () => {
    const css = fs.readFileSync(path.resolve(here, '../blocks.css'), 'utf8');
    const block = css.slice(css.indexOf('/* ---- CategoryTag'));
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(block).not.toMatch(/background:\s*var\(--(hue|tier)/);
  });
});
