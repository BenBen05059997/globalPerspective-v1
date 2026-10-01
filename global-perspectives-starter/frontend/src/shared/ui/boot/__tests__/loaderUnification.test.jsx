import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
import { render, screen, act, cleanup } from '@testing-library/react';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import LoadTopBar from '@/shared/ui/boot/LoadTopBar.jsx';

afterEach(cleanup);
const SRC = path.resolve(HERE, '../../../..');
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'test' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(jsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('one loader', () => {
  it('inline BootLoader says exactly what the caller says, no progress claim', () => {
    render(<BootLoader variant="inline" label="Loading stories" text="Loading stories" />);
    expect(screen.getByRole('status', { name: 'Loading stories' })).toBeInTheDocument();
    expect(screen.getByText('Loading stories')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
  });
  it('LoadTopBar is an indeterminate busy indicator tied to real request events', () => {
    render(<LoadTopBar />);
    expect(screen.queryByRole('progressbar')).toBeNull();
    act(() => { window.dispatchEvent(new CustomEvent('gp-loading-start')); });
    const bar = screen.getByRole('progressbar', { name: 'Loading data' });
    expect(bar).not.toHaveAttribute('aria-valuenow');
    act(() => { window.dispatchEvent(new CustomEvent('gp-loading-start')); window.dispatchEvent(new CustomEvent('gp-loading-end')); });
    expect(screen.getByRole('progressbar')).toBeInTheDocument(); // one still in flight
  });
  it('nothing imports the retired IntelligenceLoader / LoadingBar', () => {
    for (const f of walk(SRC)) {
      const s = fs.readFileSync(f, 'utf8');
      expect(/from\s+['"][^'"]*(IntelligenceLoader|LoadingBar)['"]/.test(s), f).toBe(false);
    }
    expect(fs.existsSync(path.join(SRC, 'shared/ui/IntelligenceLoader.jsx'))).toBe(false);
    expect(fs.existsSync(path.join(SRC, 'app/layout/LoadingBar.jsx'))).toBe(false);
  });
  it('no bare "Loading…" text fallbacks in features/ (use BootLoader inline)', () => {
    for (const f of walk(path.join(SRC, 'features')).filter((x) => x.endsWith('.jsx'))) {
      const s = fs.readFileSync(f, 'utf8');
      expect(/>\s*Loading(\.\.\.|…)[^<]*</.test(s) || /'Loading(\.\.\.|…)'/.test(s), f).toBe(false);
    }
  });
});
