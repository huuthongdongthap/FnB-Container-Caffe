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
    expect(screen.getByText('Failed to Load Events')).toBeInTheDocument();
    expect(screen.getByText('Failed to connect')).toBeInTheDocument();
  });

  it('renders empty state when events array is empty', () => {
    render(<StitchEvents data={{
      featured: { title: 'Test', description: 'Test', imageUrl: '', imageAlt: '', buttonLabel: 'Book' },
      activeMonth: 'OCT',
      months: ['OCT'],
      events: [],
      pastEvents: [],
    }} />);
    expect(screen.getByText('No Events Scheduled')).toBeInTheDocument();
  });

  it('renders featured hero event', () => {
    render(<StitchEvents />);
    expect(screen.getByText('FEATURED EVENT')).toBeInTheDocument();
    expect(screen.getByText('Midnight Saxophone Sessions')).toBeInTheDocument();
    expect(screen.getByText('RESERVE A SPOT')).toBeInTheDocument();
  });

  it('renders month filter tabs', () => {
    render(<StitchEvents />);
    expect(screen.getByText('OCT')).toBeInTheDocument();
    expect(screen.getByText('NOV')).toBeInTheDocument();
    expect(screen.getByText('DEC')).toBeInTheDocument();
    expect(screen.getByText('JAN')).toBeInTheDocument();
  });

  it('renders event cards with title and details', () => {
    render(<StitchEvents />);
    expect(screen.getByText('Aura Mixology Masterclass')).toBeInTheDocument();
    expect(screen.getByText('Industrial Degustation')).toBeInTheDocument();
    expect(screen.getByText('Echoes: Digital Art Night')).toBeInTheDocument();
    expect(screen.getByText('OCT 14')).toBeInTheDocument();
    expect(screen.getByText('19:00 - 21:00')).toBeInTheDocument();
  });

  it('renders past archive section', () => {
    render(<StitchEvents />);
    expect(screen.getByText('Past Archives')).toBeInTheDocument();
    expect(screen.getByText('Vinyl & Cognac')).toBeInTheDocument();
    expect(screen.getByText('Velvet Cinema Night')).toBeInTheDocument();
    expect(screen.getByText('Cyber-Lounge Launch')).toBeInTheDocument();
  });

  it('renders VIEW FULL ARCHIVE button', () => {
    render(<StitchEvents />);
    expect(screen.getByText('VIEW FULL ARCHIVE')).toBeInTheDocument();
  });

  it('calls onViewArchive when archive button is clicked', () => {
    const onViewArchive = vi.fn();
    render(<StitchEvents onViewArchive={onViewArchive} />);
    screen.getByText('VIEW FULL ARCHIVE').click();
    expect(onViewArchive).toHaveBeenCalledOnce();
  });

  it('shows empty month message when no events for active month', () => {
    render(<StitchEvents data={{
      featured: { title: 'Test', description: 'Test', imageUrl: '', imageAlt: '', buttonLabel: 'Book' },
      activeMonth: 'JAN',
      months: ['OCT', 'NOV', 'DEC', 'JAN'],
      events: [
        { id: 'e1', title: 'Test Event', description: 'Test', date: 'OCT 14', time: '19:00', imageUrl: '', imageAlt: '', buttonLabel: 'BOOK', month: 'OCT' },
      ],
      pastEvents: [],
    }} />);
    expect(screen.getByText(/No events in/)).toBeInTheDocument();
  });
});
