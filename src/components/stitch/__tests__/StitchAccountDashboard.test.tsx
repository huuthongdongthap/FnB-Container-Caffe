import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import StitchAccountDashboard from '@/components/stitch/StitchAccountDashboard';

// Controlled mock for useState to enable loading/error state testing.
// Using @testing-library/react directly (no wrapper) so the only useState
// calls come from StitchAccountDashboard itself (2 calls: loading, error).
const useStateMock = vi.hoisted(() => vi.fn((initial: unknown) => [initial, vi.fn()]));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return { ...actual, useState: useStateMock };
});

// Mock translations to return deterministic values (the translation key)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('StitchAccountDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default: useState returns [initialValue, setter]
    useStateMock.mockImplementation((initial: unknown) => [initial, vi.fn()]);
  });

  it('renders loading skeleton', () => {
    useStateMock
      .mockReturnValueOnce([true, vi.fn()])   // loading = true
      .mockReturnValueOnce([null, vi.fn()]);  // error = null

    const { container } = render(<StitchAccountDashboard />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state', () => {
    useStateMock
      .mockReturnValueOnce([false, vi.fn()])           // loading = false
      .mockReturnValueOnce(['Network error', vi.fn()]); // error = truthy string

    render(<StitchAccountDashboard />);
    // DashboardError renders translated text (mocked to return keys)
    expect(screen.getByText('stitch.accountDashboard.failedToLoad')).toBeInTheDocument();
    expect(screen.getByText('stitch.accountDashboard.retry')).toBeInTheDocument();
  });

  it('renders container with default data', () => {
    const { container } = render(<StitchAccountDashboard />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders empty transactions', () => {
    const { container } = render(<StitchAccountDashboard transactions={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with custom profile data', () => {
    const { container } = render(
      <StitchAccountDashboard
        profile={{
          name: 'Test User',
          avatar: 'https://example.com/avatar.jpg',
          tier: 'Platinum',
          memberSince: '2023',
        }}
      />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});
