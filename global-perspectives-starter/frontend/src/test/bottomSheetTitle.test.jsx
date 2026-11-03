// The sheet title wraps to at most 2 lines (CSS line-clamp) instead of a one-line ellipsis, since
// phones have no hover tooltip to reveal the rest.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import BottomSheet from '@/shared/ui/BottomSheet.jsx';

describe('BottomSheet title clamp', () => {
  it('renders the full long title in .sheet-title with no title attribute', () => {
    const t = 'Russian bombing kills 29 at Ukraine aid centre';
    render(<BottomSheet stop="peek" onStopChange={() => {}} onClose={() => {}} title={t} subtitle="War" />);
    const el = document.querySelector('.sheet-title');
    expect(el.textContent).toBe(t);
    expect(el.hasAttribute('title')).toBe(false);
  });

  it('CSS clamps to 2 lines and no longer forces one line', () => {
    const css = readFileSync('src/shared/ui/BottomSheet.css', 'utf8');
    const rule = css.match(/\.sheet-title\s*\{[^}]*\}/)[0];
    expect(rule).toMatch(/line-clamp:\s*2/);
    expect(rule).not.toMatch(/nowrap/);
  });
});
