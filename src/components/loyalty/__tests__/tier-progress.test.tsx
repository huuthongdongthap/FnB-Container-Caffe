import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { TierProgress } from '@/components/loyalty/tier-progress';

describe('TierProgress', () => {
  it('renders current and next tier names', () => {
    render(
      <TierProgress
        currentTier="Bronze"
        nextTier="Bac"
        currentSpent={250000}
        nextTierThreshold={500000}
      />,
    );
    expect(screen.getByText('Bronze')).toBeInTheDocument();
    expect(screen.getByText('Bac')).toBeInTheDocument();
  });

  it('calculates and displays progress percentage', () => {
    render(
      <TierProgress
        currentTier="Bronze"
        nextTier="Bac"
        currentSpent={250000}
        nextTierThreshold={500000}
      />,
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows spend-to-next-tier amount', () => {
    render(
      <TierProgress
        currentTier="Bronze"
        nextTier="Bac"
        currentSpent={250000}
        nextTierThreshold={500000}
      />,
    );
    // "250.000" appears in both "Da chi: 250.000 đ" and "Con 250.000 đ"
    expect(screen.getAllByText((content) => content.includes('250.000')).length).toBeGreaterThanOrEqual(1);
  });

  it('shows upgrade CTA button', () => {
    render(
      <TierProgress
        currentTier="Bronze"
        nextTier="Bac"
        currentSpent={250000}
        nextTierThreshold={500000}
      />,
    );
    expect(screen.getByRole('button', { name: /len hang/i })).toBeInTheDocument();
  });

  it('renders progress bar with correct width', () => {
    const { container } = render(
      <TierProgress
        currentTier="Bronze"
        nextTier="Bac"
        currentSpent={250000}
        nextTierThreshold={500000}
      />,
    );
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toBeInTheDocument();
  });

  it('displays 100% when spent meets or exceeds threshold', () => {
    render(
      <TierProgress
        currentTier="Bac"
        nextTier="Vang"
        currentSpent={500000}
        nextTierThreshold={500000}
      />,
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('displays 0% when spent is 0', () => {
    render(
      <TierProgress
        currentTier="Bronze"
        nextTier="Bac"
        currentSpent={0}
        nextTierThreshold={500000}
      />,
    );
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('does not render "len hang" button when at max tier', () => {
    render(
      <TierProgress
        currentTier="Bach Kim"
        nextTier={null}
        currentSpent={5000000}
        nextTierThreshold={null}
      />,
    );
    expect(screen.queryByRole('button', { name: /len hang/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Toi da/i)).toBeInTheDocument();
  });
});
