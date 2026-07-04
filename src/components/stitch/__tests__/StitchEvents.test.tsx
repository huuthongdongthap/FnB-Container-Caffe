import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import StitchEvents from '@/components/stitch/StitchEvents';

describe('StitchEvents', () => {
  it('renders loading skeleton when loadingState is loading', () => {
    const { container } = render(<StitchEvents loadingState="loading" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state when loadingState is error', () => {
    render(<StitchEvents loadingState="error" errorMessage="Failed to connect" />);
    expect(screen.getByText('Failed to connect')).toBeInTheDocument();
  });

  it('renders', () => {
    const { container } = render(<StitchEvents />);
    expect(container.firstChild).toBeTruthy();
  });
});
