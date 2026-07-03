import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import StitchAbout from '@/components/stitch/StitchAbout';

describe('StitchAbout', () => {
  it('renders loading skeleton when loadingState is loading', () => {
    const { container } = render(<StitchAbout loadingState="loading" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state when loadingState is error', () => {
    render(<StitchAbout loadingState="error" errorMessage="Failed to fetch" />);
    expect(screen.getByText('Failed to Load About Page')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });

  it('renders empty state when storyCards is empty', () => {
    render(<StitchAbout data={{
      heroTitle: 'Test',
      heroSubtitle: 'Est. 2024',
      storyTitle: 'Story',
      storyLead: 'Lead',
      storyCards: [],
      timelinePhases: [],
      values: [],
      teamMembers: [],
    }} />);
    expect(screen.getByText('No Content Available')).toBeInTheDocument();
  });

  it('renders about page with hero, story, timeline, values, team, and CTA', () => {
    render(<StitchAbout />);
    expect(screen.getByText('Established 2024')).toBeInTheDocument();
    expect(screen.getByText('The Art of the')).toBeInTheDocument();
    expect(screen.getByText('Nocturnal Pour')).toBeInTheDocument();
    expect(screen.getByText('The Blueprint')).toBeInTheDocument();
    expect(screen.getByText('Evolutionary Cycle')).toBeInTheDocument();
  });

  it('renders story cards section', () => {
    render(<StitchAbout />);
    expect(screen.getByText('Architectural Salvage')).toBeInTheDocument();
    expect(screen.getByText('Precision Brewing')).toBeInTheDocument();
    expect(screen.getByText('Nocturnal Sanctuary')).toBeInTheDocument();
  });

  it('renders timeline phases', () => {
    render(<StitchAbout />);
    expect(screen.getByText('PHASE 01: 2022')).toBeInTheDocument();
    expect(screen.getByText('PHASE 02: 2023')).toBeInTheDocument();
    expect(screen.getByText('PHASE 03: 2024')).toBeInTheDocument();
    expect(screen.getByText('The Concept Blueprint')).toBeInTheDocument();
    expect(screen.getByText('Activation')).toBeInTheDocument();
  });

  it('renders values section', () => {
    render(<StitchAbout />);
    expect(screen.getByText('Purity')).toBeInTheDocument();
    expect(screen.getByText('Integrity')).toBeInTheDocument();
    expect(screen.getByText('Sustainability')).toBeInTheDocument();
  });

  it('renders team section', () => {
    render(<StitchAbout />);
    expect(screen.getByText('Elias Thorne')).toBeInTheDocument();
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('Marcus Vane')).toBeInTheDocument();
    expect(screen.getByText('Lena Rossi')).toBeInTheDocument();
  });

  it('renders CTA section', () => {
    render(<StitchAbout />);
    expect(screen.getByText('Join the Pulse.')).toBeInTheDocument();
    expect(screen.getByText('Experience the Precision')).toBeInTheDocument();
  });

  it('calls onCtaClick when CTA button is clicked', () => {
    const onCtaClick = vi.fn();
    render(<StitchAbout onCtaClick={onCtaClick} />);
    screen.getByText('Experience the Precision').click();
    expect(onCtaClick).toHaveBeenCalledOnce();
  });
});
