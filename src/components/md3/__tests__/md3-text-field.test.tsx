import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MD3TextField } from '@/components/md3/md3-text-field';
import { Search, Eye } from 'lucide-react';

describe('MD3TextField', () => {
  it('renders with label and filled variant by default', () => {
    render(<MD3TextField label="Name" />);
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
  });

  it('applies filled variant classes', () => {
    const { container } = render(<MD3TextField label="Filled" variant="filled" />);
    const field = container.querySelector('.bg-md-surface-container-highest');
    expect(field).toBeTruthy();
  });

  it('applies outlined variant classes', () => {
    const { container } = render(<MD3TextField label="Outlined" variant="outlined" />);
    const field = container.querySelector('.border-md-outline');
    expect(field).toBeTruthy();
  });

  it('shows error message and error border', () => {
    render(<MD3TextField label="Email" error="Required field" />);
    expect(screen.getByText('Required field')).toBeTruthy();
    expect(screen.getByText('Required field').className).toContain('text-md-error');
  });

  it('shows supporting text', () => {
    render(<MD3TextField label="Phone" supportingText="Include country code" />);
    expect(screen.getByText('Include country code')).toBeTruthy();
  });

  it('displays character counter when maxLength set', () => {
    render(<MD3TextField label="Bio" maxLength={100} value="hello" onChange={vi.fn()} />);
    expect(screen.getByText('5/100')).toBeTruthy();
  });

  it('renders leading and trailing icons', () => {
    render(
      <MD3TextField
        label="Search"
        leadingIcon={<Search data-testid="leading" />}
        trailingIcon={<Eye data-testid="trailing" />}
      />,
    );
    expect(screen.getByTestId('leading')).toBeTruthy();
    expect(screen.getByTestId('trailing')).toBeTruthy();
  });

  it('handles focus and blur events', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    render(<MD3TextField label="Focus" onFocus={onFocus} onBlur={onBlur} />);
    const input = screen.getByLabelText('Focus');
    fireEvent.focus(input);
    expect(onFocus).toHaveBeenCalledTimes(1);
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('sets aria-invalid when error present', () => {
    render(<MD3TextField label="Error" error="bad" />);
    expect(screen.getByLabelText('Error').getAttribute('aria-invalid')).toBe('true');
  });

  it('forwards ref', () => {
    const ref = { current: null };
    render(<MD3TextField label="Ref" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
