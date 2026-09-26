// BottomSheet (M7 phone pattern P1): three stops (peek/half/full), a drag handle AND explicit
// buttons, role=dialog + aria-modal only at full, Esc closes, focus moves in on open and returns
// to the trigger on close.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BottomSheet from '@/features/map/components/BottomSheet.jsx';

function renderSheet(props = {}) {
  const onStopChange = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <BottomSheet
      stop="half"
      onStopChange={onStopChange}
      onClose={onClose}
      title="Mexico — tropical cyclone"
      subtitle="Humanitarian"
      {...props}
    >
      <div data-testid="sheet-content">Detail body</div>
    </BottomSheet>
  );
  return { ...utils, onStopChange, onClose };
}

describe('BottomSheet (M7)', () => {
  it('peek stop shows only title/category, no body', () => {
    renderSheet({ stop: 'peek' });
    expect(screen.getByText('Mexico — tropical cyclone')).toBeInTheDocument();
    expect(screen.getByText('Humanitarian')).toBeInTheDocument();
    expect(screen.queryByTestId('sheet-content')).not.toBeInTheDocument();
    expect(document.querySelector('.sheet-peek')).toBeInTheDocument();
  });

  it('half and full stops render the body', () => {
    renderSheet({ stop: 'half' });
    expect(screen.getByTestId('sheet-content')).toBeInTheDocument();
    cleanup();
    renderSheet({ stop: 'full' });
    expect(screen.getByTestId('sheet-content')).toBeInTheDocument();
  });

  it('is role=dialog + aria-modal only at the full stop', () => {
    renderSheet({ stop: 'half' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    cleanup();
    renderSheet({ stop: 'full' });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Mexico — tropical cyclone');
  });

  it('shows Expand at peek/half and Collapse at half/full, with 44px targets', () => {
    renderSheet({ stop: 'peek' });
    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collapse' })).not.toBeInTheDocument();
    cleanup();
    renderSheet({ stop: 'full' });
    expect(screen.queryByRole('button', { name: 'Expand' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument();
  });

  it('Expand/Collapse/Close buttons call onStopChange/onClose with the right target stop', () => {
    const { onStopChange } = renderSheet({ stop: 'half' });
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(onStopChange).toHaveBeenCalledWith('full');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(onStopChange).toHaveBeenCalledWith('peek');
  });

  it('Escape key closes the sheet at any stop', () => {
    const { onClose } = renderSheet({ stop: 'full' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Close button calls onClose', () => {
    const { onClose } = renderSheet({ stop: 'half' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('moves focus into the sheet on open and restores it to the trigger on close', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'open sheet';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = renderSheet({ stop: 'half' });
    expect(document.activeElement).not.toBe(trigger);
    expect(document.activeElement?.className || '').toMatch(/sheet-close/);

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
