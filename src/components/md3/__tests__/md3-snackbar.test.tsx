import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import { MD3Snackbar } from '../md3-snackbar';

afterEach(() => {
  vi.useRealTimers();
});

describe('MD3Snackbar', () => {
  it('renders nothing when closed', () => {
    render(<MD3Snackbar open={false} message="Hello" />);
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
  });

  it('renders message when open', () => {
    render(<MD3Snackbar open message="Order placed" />);
    expect(screen.getByText('Order placed')).toBeInTheDocument();
  });

  it('has role="status" and aria-live="polite"', () => {
    render(<MD3Snackbar open message="Test" />);
    const snackbar = screen.getByRole('status');
    expect(snackbar).toHaveAttribute('aria-live', 'polite');
  });

  it('renders action button and fires onClick', () => {
    const onClick = vi.fn();
    render(
      <MD3Snackbar open message="Copied" action={{ label: 'Undo', onClick }} />,
    );
    fireEvent.click(screen.getByText('Undo'));
    expect(onClick).toHaveBeenCalled();
  });

  it('calls onClose after duration (default 4000ms)', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<MD3Snackbar open message="Done" onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose after custom duration', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<MD3Snackbar open message="Done" onClose={onClose} duration={2000} />);
    vi.advanceTimersByTime(2000);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not auto-dismiss when duration=0', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<MD3Snackbar open message="Persistent" onClose={onClose} duration={0} />);
    vi.advanceTimersByTime(10000);
    expect(onClose).not.toHaveBeenCalled();
  });
});
