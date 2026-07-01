import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test-utils';
import { ContactForm } from '../ContactForm';
import { useContactStore } from '@/hooks/stores/use-contact-store';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  useContactStore.setState({ submitted: false, loading: false, error: null });
});

describe('ContactForm', () => {
  it('renders name, phone, message fields and submit button', () => {
    render(<ContactForm />);
    expect(screen.getByLabelText(/họ và tên/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/số điện thoại/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nội dung/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gửi/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty form', async () => {
    render(<ContactForm />);
    fireEvent.click(screen.getByRole('button', { name: /gửi/i }));

    await waitFor(() => {
      expect(screen.getByText(/vui lòng nhập tên/i)).toBeInTheDocument();
      expect(screen.getByText(/vui lòng nhập số điện thoại/i)).toBeInTheDocument();
      expect(screen.getByText(/vui lòng nhập nội dung/i)).toBeInTheDocument();
    });
  });

  it('shows phone validation error for invalid number', async () => {
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/số điện thoại/i), {
      target: { value: 'abc' },
    });
    fireEvent.click(screen.getByRole('button', { name: /gửi/i }));

    await waitFor(() => {
      expect(screen.getByText(/số điện thoại không hợp lệ/i)).toBeInTheDocument();
    });
  });

  it('submits successfully and shows success message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Success' }),
    });

    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/họ và tên/i), {
      target: { value: 'Nguyễn Văn A' },
    });
    fireEvent.change(screen.getByLabelText(/số điện thoại/i), {
      target: { value: '0946013633' },
    });
    fireEvent.change(screen.getByLabelText(/nội dung/i), {
      target: { value: 'Cà phê ngon quá!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /gửi/i }));

    await waitFor(() => {
      expect(screen.getByText(/cảm ơn/i)).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/contact'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Nguyễn Văn A'),
      }),
    );
  });

  it('shows error message when API call fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/họ và tên/i), {
      target: { value: 'Nguyễn Văn A' },
    });
    fireEvent.change(screen.getByLabelText(/số điện thoại/i), {
      target: { value: '0946013633' },
    });
    fireEvent.change(screen.getByLabelText(/nội dung/i), {
      target: { value: 'Cà phê ngon quá!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /gửi/i }));

    await waitFor(() => {
      expect(screen.getByText(/có lỗi xảy ra/i)).toBeInTheDocument();
    });
  });

  it('shows loading state during submission', async () => {
    mockFetch.mockImplementationOnce(
      () => new Promise<Response>((resolve) =>
        setTimeout(() => resolve({ ok: true, json: async () => ({}) } as Response), 500),
      ),
    );

    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/họ và tên/i), {
      target: { value: 'Nguyễn Văn A' },
    });
    fireEvent.change(screen.getByLabelText(/số điện thoại/i), {
      target: { value: '0946013633' },
    });
    fireEvent.change(screen.getByLabelText(/nội dung/i), {
      target: { value: 'Cà phê ngon quá!' },
    });

    const button = screen.getByRole('button', { name: /gửi/i });
    fireEvent.click(button);

    expect(button).toBeDisabled();
  });
});
