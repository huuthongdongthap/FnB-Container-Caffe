import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { Input } from '@/components/ui/input';

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Họ tên" />);
    expect(screen.getByLabelText('Họ tên')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<Input label="Email" error="Email không hợp lệ" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Email không hợp lệ');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows helper text', () => {
    render(<Input label="Số điện thoại" helperText="Nhập số 10 chữ số" />);
    expect(screen.getByText('Nhập số 10 chữ số')).toBeInTheDocument();
  });

  it('sets aria-required when required', () => {
    render(<Input label="Bắt buộc" required />);
    expect(screen.getByLabelText('Bắt buộc')).toBeRequired();
  });
});
