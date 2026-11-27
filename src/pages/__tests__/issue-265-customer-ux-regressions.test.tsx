import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GuestInfoForm } from '@/pages/TableOrder-components';
import { reviewRecordToEntry } from '@/pages/ReviewsPage-utils';
import { getShellConfig } from '@/components/stitch/shell-config';
import TableCheckin from '@/pages/TableCheckin';
import ForgotPasswordPage from '@/pages/forgot-password';

describe('Issue #265 customer frontend & UX regressions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders GuestInfoForm in sticky document flow rather than fixed overlay', () => {
    render(
      <MemoryRouter>
        <GuestInfoForm
          guestName=""
          guestPhone=""
          paymentMethod="cod"
          isSubmitting={false}
          submitError={null}
          onNameChange={() => {}}
          onPhoneChange={() => {}}
        />
      </MemoryRouter>,
    );
    const bar = screen.getByTestId('table-order-guest-form');
    expect(bar.className).toContain('sticky');
    expect(bar.className).not.toContain('fixed');
  });

  it('maps review content field when comment is absent', () => {
    const entry = reviewRecordToEntry({
      id: 'rev-1',
      order_id: 'ord-1',
      customer_name: 'Minh',
      rating: 5,
      comment: '',
      content: 'Cà phê muối rất ngon!',
      created_at: '2026-11-26T10:00:00Z',
    } as Parameters<typeof reviewRecordToEntry>[0]);
    expect(entry.content).toBe('Cà phê muối rất ngon!');
  });

  it('strips /vi and /en locale prefixes in getShellConfig for /order', () => {
    const viConfig = getShellConfig('/vi/order');
    const enConfig = getShellConfig('/en/order');
    expect(viConfig?.showTop).toBe(false);
    expect(viConfig?.showNav).toBe(false);
    expect(enConfig?.showTop).toBe(false);
    expect(enConfig?.showNav).toBe(false);
  });

  it('rejects invalid phone numbers on /table-checkin without writing to localStorage', () => {
    window.history.pushState({}, '', '/table-checkin?table=1');
    render(
      <MemoryRouter initialEntries={['/table-checkin?table=1']}>
        <TableCheckin />
      </MemoryRouter>,
    );
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0]!, { target: { value: 'Khach Hang' } });
    fireEvent.change(inputs[1]!, { target: { value: 'abc' } });
    const submitBtn = screen.getByRole('button', { name: /xác nhận/i });
    fireEvent.click(submitBtn);

    expect(window.localStorage.getItem('aura_saved_customer')).toBeNull();
    expect(screen.getByText(/Số điện thoại không hợp lệ/i)).toBeTruthy();
  });

  it('links forgot-password back-to-login to customer /login instead of /admin/login', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /Quay lại đăng nhập/i });
    expect(link.getAttribute('href')).toBe('/login');
  });
});
