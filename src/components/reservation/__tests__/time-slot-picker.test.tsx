import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import { TimeSlotPicker } from '@/components/reservation/TimeSlotPicker';
import { IdentityVerification } from '@/components/reservation/IdentityVerification';
import { ReservationForm } from '@/components/reservation/ReservationForm';
import { TableMap } from '@/components/reservation/TableMap';
import type { TableInfo } from '@/hooks/use-reservations';

describe('TimeSlotPicker', () => {
  const slots = [
    { time: '19:00', available: true },
    { time: '20:00', available: true },
    { time: '21:00', available: false },
    { time: '23:59', available: true },
    { time: '23:00', available: false },
  ];

  it('renders all time slots', () => {
    render(<TimeSlotPicker slots={slots} selectedTime="" onSelect={vi.fn()} />);
    expect(screen.getByText('19:00')).toBeInTheDocument();
    expect(screen.getByText('23:00')).toBeInTheDocument();
  });

  it('allows selection of available slots', () => {
    const onSelect = vi.fn();
    // Use a far-future time so the test works regardless of current hour
    render(<TimeSlotPicker slots={[{ time: '23:59', available: true }]} selectedTime="" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('23:59'));
    expect(onSelect).toHaveBeenCalledWith('23:59');
  });

  it('disables unavailable slots', () => {
    const onSelect = vi.fn();
    render(<TimeSlotPicker slots={slots} selectedTime="" onSelect={onSelect} />);
    const unavailBtn = screen.getByText('21:00').closest('button');
    expect(unavailBtn).toBeDisabled();
  });

  it('highlights the selected time slot', () => {
    render(<TimeSlotPicker slots={slots} selectedTime="20:00" onSelect={vi.fn()} />);
    const selectedBtn = screen.getByText('20:00').closest('button');
    expect(selectedBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('IdentityVerification', () => {
  it('renders a form modal replacing prompt()', () => {
    render(
      <IdentityVerification open={true} onClose={vi.fn()} onVerify={vi.fn()} />
    );
    expect(screen.getByLabelText(/họ và tên/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/số điện thoại/i)).toBeInTheDocument();
    expect(screen.getByText(/Xác Nhận/)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <IdentityVerification open={false} onClose={vi.fn()} onVerify={vi.fn()} />
    );
    expect(screen.queryByLabelText(/họ và tên/i)).not.toBeInTheDocument();
  });

  it('validates phone number before submitting', () => {
    const onVerify = vi.fn();
    render(
      <IdentityVerification open={true} onClose={vi.fn()} onVerify={onVerify} />
    );

    const nameInput = screen.getByLabelText(/họ và tên/i);
    const phoneInput = screen.getByLabelText(/số điện thoại/i);

    fireEvent.change(nameInput, { target: { value: 'Nguyen Van A' } });
    fireEvent.change(phoneInput, { target: { value: '123' } });
    fireEvent.click(screen.getByText(/Xác Nhận/));

    expect(onVerify).not.toHaveBeenCalled();
    expect(screen.getByText(/số điện thoại không hợp lệ/i)).toBeInTheDocument();
  });

  it('calls onVerify with valid data', () => {
    const onVerify = vi.fn();
    render(
      <IdentityVerification open={true} onClose={vi.fn()} onVerify={onVerify} />
    );

    const nameInput = screen.getByLabelText(/họ và tên/i);
    const phoneInput = screen.getByLabelText(/số điện thoại/i);

    fireEvent.change(nameInput, { target: { value: 'Nguyen Van A' } });
    fireEvent.change(phoneInput, { target: { value: '0901234567' } });
    fireEvent.click(screen.getByText(/Xác Nhận/));

    expect(onVerify).toHaveBeenCalledWith({ name: 'Nguyen Van A', phone: '0901234567' });
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    render(
      <IdentityVerification open={true} onClose={onClose} onVerify={vi.fn()} />
    );
    fireEvent.click(screen.getByText(/Huỷ/));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ReservationForm', () => {
  it('renders date picker and guest count', () => {
    render(
      <ReservationForm
        date=""
        guests={2}
        onDateChange={vi.fn()}
        onGuestsChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/Ngày/)).toBeInTheDocument();
    expect(screen.getByText(/Số khách/)).toBeInTheDocument();
  });

  it('submits with current selections', () => {
    const onSubmit = vi.fn();
    render(
      <ReservationForm
        date="2026-07-05"
        guests={4}
        onDateChange={vi.fn()}
        onGuestsChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    fireEvent.click(screen.getByText(/Đặt bàn/));
    expect(onSubmit).toHaveBeenCalled();
  });
});

describe('TableMap', () => {
  const tables: TableInfo[] = [
    { id: 'B01', table_number: 'B01', zone: 'VIP', available: true },
    { id: 'B02', table_number: 'B02', zone: 'VIP', available: false },
    { id: 'T01', table_number: 'T01', zone: 'Indoor', available: true },
  ];

  it('renders tables for the selected zone', () => {
    render(
      <TableMap
        tables={tables}
        zone="VIP"
        selectedTable=""
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('#B01')).toBeInTheDocument();
  });

  it('shows available tables as clickable', () => {
    const onSelect = vi.fn();
    render(
      <TableMap
        tables={tables}
        zone="VIP"
        selectedTable=""
        onSelect={onSelect}
      />
    );
    const btn = screen.getByText('#B01').closest('button');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn!);
    expect(onSelect).toHaveBeenCalledWith('B01');
  });

  it('shows booked tables as disabled', () => {
    render(
      <TableMap
        tables={tables}
        zone="VIP"
        selectedTable=""
        onSelect={vi.fn()}
      />
    );
    const bookedBtn = screen.getByText('#B02').closest('button');
    expect(bookedBtn).toBeDisabled();
  });

  it('highlights selected table', () => {
    render(
      <TableMap
        tables={tables}
        zone="VIP"
        selectedTable="B01"
        onSelect={vi.fn()}
      />
    );
    const selectedBtn = screen.getByText('#B01').closest('button');
    expect(selectedBtn).toHaveAttribute('aria-pressed', 'true');
  });
});
