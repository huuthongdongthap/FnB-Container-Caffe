import StitchHeader from '@/components/stitch/StitchHeader';
import StitchHero from '@/components/stitch/StitchHero';
import StitchStats from '@/components/stitch/StitchStats';
import StitchMenuGrid from '@/components/stitch/StitchMenuGrid';
import StitchZones from '@/components/stitch/StitchZones';
import StitchTestimonials from '@/components/stitch/StitchTestimonials';
import StitchLocation from '@/components/stitch/StitchLocation';
import StitchFooter from '@/components/stitch/StitchFooter';

export default function StitchLandingPage() {
  return (
    <main className="min-h-screen bg-[#0A1A2E] text-[#e4e2e4] overflow-x-hidden">
      <StitchHeader />
      <StitchHero />
      <StitchStats />
      <StitchMenuGrid />
      <StitchZones />
      <StitchTestimonials />
      <StitchLocation />
      <StitchFooter />
    </main>
  );
}
