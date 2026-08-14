import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test-utils';
import { ReferralBlock } from '../loyalty-referral-block';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'loyalty.referralSectionAria': 'Referral Section',
        'loyalty.referEarn': 'Refer & Earn',
        'loyalty.referDescription': 'Invite friends and earn bonus points.',
        'loyalty.copy': 'Copy',
        'loyalty.copied': 'Copied',
        'loyalty.copyCodeAria': 'Copy code',
        'loyalty.codeCopiedAria': 'Code copied',
        'loyalty.shareCodeAria': 'Share code',
        'loyalty.shareInviteLink': 'Share Invite Link',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

describe('ReferralBlock', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders heading and description', () => {
    renderWithProviders(<ReferralBlock code="FRIEND-123" />);
    expect(screen.getByText('Refer & Earn')).toBeTruthy();
    expect(screen.getByText('Invite friends and earn bonus points.')).toBeTruthy();
  });

  it('displays referral code', () => {
    renderWithProviders(<ReferralBlock code="FRIEND-123" />);
    expect(screen.getByText('FRIEND-123')).toBeTruthy();
  });

  it('copies code to clipboard and shows copied state', async () => {
    renderWithProviders(<ReferralBlock code="FRIEND-123" />);
    fireEvent.click(screen.getByText('Copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('FRIEND-123');
    await waitFor(() => {
      expect(screen.getByText('Copied')).toBeTruthy();
    });
  });

  it('calls onShare when share button clicked', () => {
    const onShare = vi.fn();
    renderWithProviders(<ReferralBlock code="FRIEND-123" onShare={onShare} />);
    screen.getByText('Share Invite Link').click();
    expect(onShare).toHaveBeenCalledOnce();
  });

  it('renders share icon button', () => {
    renderWithProviders(<ReferralBlock code="FRIEND-123" />);
    expect(screen.getByLabelText('Share code')).toBeTruthy();
  });
});
