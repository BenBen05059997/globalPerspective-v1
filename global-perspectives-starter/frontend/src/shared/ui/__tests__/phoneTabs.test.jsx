// PhoneTabs — one tab switch per page: a real tablist, aria-selected on the active tab, arrow keys /
// Home / End move and select, and the panel props pair each panel with its tab.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PhoneTabs, { phonePanelProps, phoneTabIds } from '@/shared/ui/PhoneTabs.jsx';

const TABS = [{ key: 'read', label: 'Read' }, { key: 'map', label: 'Map' }, { key: 'log', label: 'Log' }];

describe('PhoneTabs', () => {
  it('renders a tablist with the active tab selected', () => {
    render(<PhoneTabs tabs={TABS} active="map" onChange={() => {}} label="View" idBase="x" />);
    expect(screen.getByRole('tablist', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Read' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Read' })).toHaveAttribute('tabindex', '-1');
  });
  it('click and arrow keys select (wrapping), Home / End jump', () => {
    const onChange = vi.fn();
    render(<PhoneTabs tabs={TABS} active="log" onChange={onChange} label="View" idBase="x" />);
    const list = screen.getByRole('tablist');
    fireEvent.click(screen.getByRole('tab', { name: 'Read' }));
    expect(onChange).toHaveBeenLastCalledWith('read');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('read'); // wraps from the last
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('map');
    fireEvent.keyDown(list, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('read');
    fireEvent.keyDown(list, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('log');
  });
  it('panel props reference the matching tab', () => {
    const ids = phoneTabIds('x', 'map');
    expect(phonePanelProps('x', 'map')).toMatchObject({ id: ids.panel, role: 'tabpanel', 'aria-labelledby': ids.tab });
  });
});
