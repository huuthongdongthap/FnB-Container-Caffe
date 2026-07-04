import StitchLandingNew from '@/components/stitch/StitchLandingNew';
import StitchMenuGrid from '@/components/stitch/StitchMenuGrid';
import StitchZones from '@/components/stitch/StitchZones';
import { StitchReviews } from '@/components/stitch';

export function HomePage() {
  return (
    <>
      <StitchLandingNew />
      <StitchMenuGrid />
      <StitchZones />
      <StitchReviews />
    </>
  );
}
