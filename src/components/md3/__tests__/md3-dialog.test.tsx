import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import { MD3Dialog } from '../md3-dialog';

describe('MD3Dialog', () => {
  it('renders nothing when closed', () => {
    render(<MD3Dialog open={false} onClose={vi.fn()} title="Test">Body</MD3Dialog>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders with title and children when open', () => {
    render(<MD3Dialog open onClose={vi.fn()} title="Confirm">Are you sure?</MD3Dialog>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('has aria-modal="true"', () => {
    render(<MD3Dialog open onClose={vi.fn()}>Content</MD3Dialog>);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(<MD3Dialog open onClose={onClose}>Content</MD3Dialog>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on scrim click', () => {
    const onClose = vi.fn();
    render(<MD3Dialog open onClose={onClose}>Content</MD3Dialog>);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close on scrim click when preventScrimClose=true', () => {
    const onClose = vi.fn();
    render(
      <MD3Dialog open onClose={onClose} preventScrimClose>
        Content
      </MD3Dialog>,
    );
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders action buttons', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <MD3Dialog
        open
        onClose={vi.fn()}
        actions={[
          <button key="cancel" onClick={onCancel}>Cancel</button>,
          <button key="confirm" onClick={onConfirm}>Confirm</button>,
        ]}
      >
        Body
      </MD3Dialog>,
    );
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Confirm'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<MD3Dialog open onClose={vi.fn()} className="my-dialog">Body</MD3Dialog>);
    const dialog = screen.getByRole('dialog');
    // className is on the inner content div, find it
    const inner = dialog.querySelector('.my-dialog');
    expect(inner).toBeInTheDocument();
  });
});
