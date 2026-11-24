import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NewsletterSection } from '../newsletter-section';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

describe('NewsletterSection lead capture validation and payload routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('normalizes phone input and submits phone payload to /api/leads', async () => {
    mockApiFetch.mockResolvedValueOnce({ success: true });

    render(<NewsletterSection />);
    const input = screen.getByPlaceholderText(/email hoặc số điện thoại/i);
    fireEvent.change(input, { target: { value: '+84 901 234 567' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/leads', {
        method: 'POST',
        body: JSON.stringify({ phone: '84901234567', source: 'promotions_newsletter' }),
      });
      expect(screen.getByText(/Cảm ơn bạn đã tham gia AURA VIP Club/i)).toBeTruthy();
    });
  });

  it('routes email addresses containing 9+ digits as email rather than phone', async () => {
    mockApiFetch.mockResolvedValueOnce({ success: true });

    render(<NewsletterSection />);
    const input = screen.getByPlaceholderText(/email hoặc số điện thoại/i);
    fireEvent.change(input, { target: { value: 'vip0901234567@auracafe.vn' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/leads', {
        method: 'POST',
        body: JSON.stringify({ email: 'vip0901234567@auracafe.vn', source: 'promotions_newsletter' }),
      });
    });
  });

  it('rejects malformed alphanumeric contact strings without calling /api/leads', async () => {
    render(<NewsletterSection />);
    const input = screen.getByPlaceholderText(/email hoặc số điện thoại/i);
    fireEvent.change(input, { target: { value: 'abc0901234567' } });
    fireEvent.submit(input.closest('form')!);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('email hoặc số điện thoại hợp lệ');
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
