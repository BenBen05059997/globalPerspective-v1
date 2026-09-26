// MapPhoneTabs (F2.9): WAI-ARIA tabs pattern — roving tabindex plus ArrowLeft/ArrowRight/Home/End
// move focus AND select (automatic activation), matching the phone MAP·LIST·ALERTS switch.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MapPhoneTabs from '@/features/map/components/MapPhoneTabs.jsx';

function renderTabs(active = 'map') {
  const onChange = vi.fn();
  const utils = render(<MapPhoneTabs active={active} onChange={onChange} />);
  return { ...utils, onChange };
}

describe('MapPhoneTabs (F2.9)', () => {
  it('only the active tab is in the tab order (roving tabindex)', () => {
    renderTabs('map');
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'List' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Alerts' })).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowRight moves to and selects the next tab, wrapping past the last', () => {
    const { onChange } = renderTabs('map');
    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('list');
    onChange.mockClear();

    // wraps from the last tab back to the first
    const { onChange: onChange2 } = renderTabs('alerts');
    fireEvent.keyDown(screen.getAllByRole('tablist')[1], { key: 'ArrowRight' });
    expect(onChange2).toHaveBeenCalledWith('map');
  });

  it('ArrowLeft moves to and selects the previous tab, wrapping before the first', () => {
    const { onChange } = renderTabs('map');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('alerts');
  });

  it('Home selects the first tab, End selects the last', () => {
    const { onChange } = renderTabs('list');
    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith('alerts');
    onChange.mockClear();
    fireEvent.keyDown(tablist, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith('map');
  });

  it('ignores other keys', () => {
    const { onChange } = renderTabs('map');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
