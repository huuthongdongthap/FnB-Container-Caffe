import { describe, it, expect, vi, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import { useRef } from 'react';
import { MD3Menu, MD3MenuItem } from '../md3-menu';

/* All tests use a proper React component wrapper so useRef is valid */

function MenuHarness({
  open = true,
  onClose = vi.fn(),
  children,
}: {
  open?: boolean;
  onClose?: Mock;
  children?: React.ReactNode;
}) {
  const anchorRef = useRef<HTMLElement>(null);
  return (
    <>
      <button ref={anchorRef as React.RefObject<HTMLButtonElement>}>Anchor</button>
      <MD3Menu open={open} anchorRef={anchorRef} onClose={onClose}>
        {children ?? (
          <>
            <MD3MenuItem label="Item One" onClick={vi.fn()} />
            <MD3MenuItem label="Item Two" disabled divider />
            <MD3MenuItem label="Item Three" icon={<span data-testid="icon">★</span>} />
          </>
        )}
      </MD3Menu>
    </>
  );
}

describe('MD3Menu', () => {
  it('renders nothing when closed', () => {
    render(<MenuHarness open={false} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders menu with items when open', () => {
    render(<MenuHarness />);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Item One' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Item Two' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Item Three/ })).toBeInTheDocument();
  });

  it('applies disabled styling and disables pointer events', () => {
    render(<MenuHarness />);
    const disabled = screen.getByRole('menuitem', { name: 'Item Two' });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveClass('opacity-38', 'pointer-events-none');
  });

  it('calls onClick when enabled item clicked', () => {
    const onClick = vi.fn();
    render(
      <MenuHarness>
        <MD3MenuItem label="Click Me" onClick={onClick} />
      </MenuHarness>,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Click Me' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(<MenuHarness onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on click outside', () => {
    const onClose = vi.fn();
    render(<MenuHarness onClose={onClose} />);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders divider after item when divider=true', () => {
    render(<MenuHarness />);
    const separators = screen.getAllByRole('separator');
    expect(separators.length).toBeGreaterThan(0);
  });

  it('renders trailing text and icon', () => {
    render(
      <MenuHarness>
        <MD3MenuItem label="Save" trailingText="Ctrl+S" icon={<span data-testid="icon">💾</span>} />
      </MenuHarness>,
    );
    expect(screen.getByText('Ctrl+S')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});
