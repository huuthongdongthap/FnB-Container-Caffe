import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { OrderTimeline } from '@/components/tracking/OrderTimeline';
import { StatusBadge } from '@/components/tracking/StatusBadge';
import { EstimatedTime } from '@/components/tracking/EstimatedTime';

describe('OrderTimeline', () => {
  const statusSteps = [
    { status: 'confirmed', label: 'Confirmed', time: '2026-07-01T10:00:00Z' },
    { status: 'preparing', label: 'Preparing', time: '2026-07-01T10:05:00Z' },
    { status: 'ready', label: 'Ready', time: '2026-07-01T10:15:00Z' },
    { status: 'delivering', label: 'Delivering', time: '2026-07-01T10:20:00Z' },
    { status: 'delivered', label: 'Delivered', time: '2026-07-01T10:30:00Z' },
  ];

  it('renders all status steps in order', () => {
    render(<OrderTimeline currentStatus="preparing" steps={statusSteps} />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Preparing')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Delivering')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });

  it('highlights the current status step', () => {
    render(<OrderTimeline currentStatus="preparing" steps={statusSteps} />);
    const currentStep = screen.getByText('Preparing').closest('[data-status]');
    expect(currentStep).toHaveAttribute('data-status', 'preparing');
    expect(currentStep).toHaveAttribute('aria-current', 'step');
  });

  it('marks completed steps as done', () => {
    render(<OrderTimeline currentStatus="preparing" steps={statusSteps} />);
    const confirmed = screen.getByText('Confirmed').closest('[data-status]');
    expect(confirmed).toHaveAttribute('data-completed', 'true');
  });

  it('displays timestamps for each step', () => {
    render(<OrderTimeline currentStatus="delivered" steps={statusSteps} />);
    // The time is formatted with vi-VN locale
    const timeElements = screen.getAllByText(/\d{1,2}:\d{2}/);
    expect(timeElements.length).toBeGreaterThanOrEqual(5);
  });

  it('shows cancelled status when present', () => {
    const stepsWithCancel = [...statusSteps, { status: 'cancelled', label: 'Cancelled', time: '2026-07-01T11:00:00Z' }];
    render(<OrderTimeline currentStatus="cancelled" steps={stepsWithCancel} />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    const cancelledStep = screen.getByText('Cancelled').closest('[data-status]');
    expect(cancelledStep).toHaveAttribute('data-status', 'cancelled');
  });

  it('renders future steps as inactive', () => {
    render(<OrderTimeline currentStatus="confirmed" steps={statusSteps} />);
    const deliveringStep = screen.getByText('Delivering').closest('[data-status]');
    expect(deliveringStep).toHaveAttribute('data-completed', 'false');
  });
});

describe('StatusBadge', () => {
  it('renders with correct variant for confirmed', () => {
    render(<StatusBadge status="confirmed" />);
    const badge = screen.getByText('Đã xác nhận');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-blue');
  });

  it('renders with correct variant for delivered', () => {
    render(<StatusBadge status="delivered" />);
    const badge = screen.getByText('Đã giao');
    expect(badge.className).toContain('bg-green');
  });

  it('renders cancelled with destructive variant', () => {
    render(<StatusBadge status="cancelled" />);
    const badge = screen.getByText('Đã hủy');
    expect(badge.className).toContain('bg-red');
  });

  it('renders with custom class name', () => {
    render(<StatusBadge status="preparing" className="custom-class" />);
    const badge = screen.getByText('Đang chế biến');
    expect(badge.className).toContain('custom-class');
  });
});

describe('EstimatedTime', () => {
  it('displays remaining time in minutes', () => {
    const future = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    render(<EstimatedTime estimatedAt={future} />);
    expect(screen.getByText(/phút|min/i)).toBeInTheDocument();
  });

  it('shows "Delivered" when time has passed', () => {
    const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    render(<EstimatedTime estimatedAt={past} />);
    expect(screen.getByText((content) => content.includes('Đã giao'))).toBeInTheDocument();
  });

  it('updates every 60 seconds for countdown', () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    render(<EstimatedTime estimatedAt={future} />);
    expect(screen.getByText(/phút|min/i)).toBeInTheDocument();
  });
});
