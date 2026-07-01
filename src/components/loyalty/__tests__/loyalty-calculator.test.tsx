import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@/test-utils';
import { LoyaltyCalculator } from '@/components/loyalty/loyalty-calculator';

describe('LoyaltyCalculator', () => {
  it('renders input fields for monthly spend', () => {
    render(<LoyaltyCalculator />);
    expect(screen.getByLabelText(/Chi tieu hang thang/i)).toBeInTheDocument();
  });

  it('renders input for visit frequency', () => {
    render(<LoyaltyCalculator />);
    expect(screen.getByLabelText(/Tan suat ghe tham/i)).toBeInTheDocument();
  });

  it('renders input for referral count', () => {
    render(<LoyaltyCalculator />);
    expect(screen.getByLabelText(/So luot gioi thieu/i)).toBeInTheDocument();
  });

  it('displays projected tier based on spend input', () => {
    render(<LoyaltyCalculator />);
    // Default spend of 2.5M * 12 = 30M annual = Bach Kim tier
    // Check the tier display section
    expect(screen.getByText(/Hang du kien/i)).toBeInTheDocument();
  });

  it('displays estimated points earned', () => {
    render(<LoyaltyCalculator />);
    expect(screen.getByText(/diem \/ thang/i)).toBeInTheDocument();
  });

  it('displays cashback value estimation', () => {
    render(<LoyaltyCalculator />);
    expect(screen.getByText(/cashback \/ thang/i)).toBeInTheDocument();
  });

  it('handles 0 monthly spend edge case', () => {
    render(<LoyaltyCalculator />);
    const spendInput = screen.getByLabelText(/Chi tieu hang thang/i);
    fireEvent.change(spendInput, { target: { value: '0' } });
    expect(screen.getByText(/Hang du kien/i)).toBeInTheDocument();
  });

  it('renders referral earnings section', () => {
    render(<LoyaltyCalculator />);
    expect(screen.getByText(/Thu nhap tu gioi thieu/i)).toBeInTheDocument();
  });

  it('shows cashback value per referral as 10,000đ', () => {
    render(<LoyaltyCalculator />);
    expect(screen.getByText(/10.000/)).toBeInTheDocument();
  });

  it('shows referral terms note', () => {
    render(<LoyaltyCalculator />);
    expect(screen.getByText(/20.000d/)).toBeInTheDocument();
  });

  it('renders total benefit section', () => {
    render(<LoyaltyCalculator />);
    expect(screen.getByText(/Tong loi ich uoc tinh/i)).toBeInTheDocument();
  });
});
