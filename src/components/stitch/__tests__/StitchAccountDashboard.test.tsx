import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import StitchAccountDashboard from '@/components/stitch/StitchAccountDashboard';

describe('StitchAccountDashboard', () => {
  it('renders profile header with name and tier', () => {
    render(<StitchAccountDashboard />);
    expect(screen.getByText('AURA CAFE')).toBeInTheDocument();
    expect(screen.getByText('Julian Vane')).toBeInTheDocument();
    expect(screen.getByText('Gold Tier Member')).toBeInTheDocument();
  });

  it('renders loyalty section with points balance', () => {
    render(<StitchAccountDashboard />);
    expect(screen.getByText('Current Balance')).toBeInTheDocument();
    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('Next Tier: Platinum')).toBeInTheDocument();
    expect(screen.getByText('250 pts to go')).toBeInTheDocument();
  });

  it('renders quick order button', () => {
    render(<StitchAccountDashboard />);
    expect(screen.getByText('Quick Order')).toBeInTheDocument();
  });

  it('renders subscription section', () => {
    render(<StitchAccountDashboard />);
    expect(screen.getByText('Gold Tier')).toBeInTheDocument();
    expect(screen.getByText('Next billing: Aug 1, 2026')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Manage Subscription')).toBeInTheDocument();
  });

  it('renders recent transactions', () => {
    render(<StitchAccountDashboard />);
    expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    expect(screen.getByText('Truffle Cortado')).toBeInTheDocument();
    expect(screen.getByText('Gold Leaf Croissant')).toBeInTheDocument();
    expect(screen.getByText('Iced Obsidian Brew')).toBeInTheDocument();
    expect(screen.getByText('Smoked Salmon Toast')).toBeInTheDocument();
  });

  it('renders bottom navigation', () => {
    render(<StitchAccountDashboard />);
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Loyalty')).toBeInTheDocument();
    expect(screen.getByText('Reserve')).toBeInTheDocument();
  });

  it('renders membership card', () => {
    render(<StitchAccountDashboard />);
    expect(screen.getByText('AURA')).toBeInTheDocument();
    expect(screen.getByText('MEMBER SINCE 2022')).toBeInTheDocument();
  });

  it('renders empty state when no transactions', () => {
    render(<StitchAccountDashboard transactions={[]} />);
    expect(screen.getByText('No Transactions Yet')).toBeInTheDocument();
    expect(screen.getByText('Your order history will appear here once you make your first purchase.')).toBeInTheDocument();
  });

  it('renders transaction status badges', () => {
    render(<StitchAccountDashboard />);
    expect(screen.getByText('Preparing')).toBeInTheDocument();
    expect(screen.getAllByText('Delivered').length).toBeGreaterThanOrEqual(1);
  });
});
