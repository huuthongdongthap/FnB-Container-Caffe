import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test-utils';
import { ReferralLink } from '@/components/referral/referral-link';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ReferralLink', () => {
  it('renders the referral code', () => {
    render(<ReferralLink code="FNB-ABCDEF" referralCount={3} />);
    expect(screen.getByText('FNB-ABCDEF')).toBeInTheDocument();
  });

  it('renders referral count', () => {
    render(<ReferralLink code="FNB-ABCDEF" referralCount={3} />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it('copies code to clipboard when copy button clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ReferralLink code="FNB-ABCDEF" referralCount={0} />);
    const copyBtn = screen.getByRole('button', { name: /sao chep ma/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('FNB-ABCDEF');
    });
  });

  it('shows "Da sao chep!" after copying', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    render(<ReferralLink code="FNB-ABCDEF" referralCount={0} />);
    const copyBtn = screen.getByRole('button', { name: /sao chep ma/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Da sao chep/i)).toBeInTheDocument();
    });
  });

  it('renders share CTA buttons', () => {
    render(<ReferralLink code="FNB-ABCDEF" referralCount={2} />);
    expect(screen.getByRole('button', { name: /zalo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /facebook/i })).toBeInTheDocument();
  });

  it('shows referral count as 0 when no referrals', () => {
    render(<ReferralLink code="FNB-ABCDEF" referralCount={0} />);
    expect(screen.getByText(/0/)).toBeInTheDocument();
  });

  it('has a referral code input field for guests', () => {
    render(<ReferralLink code="FNB-ABCDEF" referralCount={1} />);
    expect(screen.getByPlaceholderText(/nhap ma/i)).toBeInTheDocument();
  });

  it('calls onApplyCode when apply button clicked', () => {
    const onApplyCode = vi.fn();
    render(<ReferralLink code="FNB-ABCDEF" referralCount={1} onApplyCode={onApplyCode} />);
    const input = screen.getByPlaceholderText(/nhap ma/i);
    fireEvent.change(input, { target: { value: 'FNB-OTHER' } });
    const applyBtn = screen.getByRole('button', { name: /ap dung/i });
    fireEvent.click(applyBtn);
    expect(onApplyCode).toHaveBeenCalledWith('FNB-OTHER');
  });
});
