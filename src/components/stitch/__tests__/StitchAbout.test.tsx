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
      heroSubtitle: 'Industrial-Luxury Container Caffe',
      storyTitle: 'Story',
      storyLead: 'Lead',
      storyCards: [],
      timelinePhases: [],
      values: [],
      zones: [],
    }} />);
    expect(screen.getByText('No Content Available')).toBeInTheDocument();
  });

  it('renders about page with hero, story, timeline, values, zones, and CTA', () => {
    render(<StitchAbout />);
    expect(screen.getAllByText(/Container Bản Địa/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/AURA CAFE/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/39 Nguyễn Tất Thành/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Câu chuyện/i)).toBeInTheDocument();
    expect(screen.getByText(/Hành trình/i)).toBeInTheDocument();
  });

  it('renders story cards section', () => {
    render(<StitchAbout />);
    expect(screen.getByText('Container Concept')).toBeInTheDocument();
    expect(screen.getByText('QR Ordering')).toBeInTheDocument();
    expect(screen.getByText('Trải Nghiệm Gần Gũi')).toBeInTheDocument();
  });

  it('renders timeline phases', () => {
    render(<StitchAbout />);
    expect(screen.getByText('PHASE 01: 2022')).toBeInTheDocument();
    expect(screen.getByText('PHASE 02: 2023')).toBeInTheDocument();
    expect(screen.getByText('PHASE 03: 2024')).toBeInTheDocument();
    expect(screen.getByText('PHASE 04: 2025')).toBeInTheDocument();
    expect(screen.getByText('PHASE 05: 2026')).toBeInTheDocument();
    expect(screen.getByText('Khởi nguồn / The Vision')).toBeInTheDocument();
    expect(screen.getByText('Hoàn thiện / Full Experience')).toBeInTheDocument();
  });

  it('renders values section', () => {
    render(<StitchAbout />);
    expect(screen.getByText('Cà phê ngon giá bình dân / Good Coffee Fair Price')).toBeInTheDocument();
    expect(screen.getByText('Không gian mộc mạc / Rustic Space')).toBeInTheDocument();
    expect(screen.getByText('Công nghệ tiện lợi / Handy Tech')).toBeInTheDocument();
  });

  it('renders zones section', () => {
    render(<StitchAbout />);
    expect(screen.getByText('Quầy Pha Chế')).toBeInTheDocument();
    expect(screen.getByText('Sân Thượng')).toBeInTheDocument();
    expect(screen.getByText('Góc Yên Tĩnh')).toBeInTheDocument();
    expect(screen.getByText('Khu Sofa')).toBeInTheDocument();
    expect(screen.getByText('Phòng Riêng')).toBeInTheDocument();
  });

  it('renders CTA section', () => {
    render(<StitchAbout />);
    expect(screen.getByText('Ghé thăm AURA CAFE')).toBeInTheDocument();
    expect(screen.getByText('Khám phá ngay / Explore Now')).toBeInTheDocument();
  });

  it('calls onCtaClick when CTA button is clicked', () => {
    const onCtaClick = vi.fn();
    render(<StitchAbout onCtaClick={onCtaClick} />);
    screen.getByText('Khám phá ngay / Explore Now').click();
    expect(onCtaClick).toHaveBeenCalledOnce();
  });

  it('calls onZoneClick when a zone is clicked', () => {
    const onZoneClick = vi.fn();
    render(<StitchAbout onZoneClick={onZoneClick} />);
    screen.getByText('Quầy Pha Chế').click();
    expect(onZoneClick).toHaveBeenCalledWith('z1');
  });
});
