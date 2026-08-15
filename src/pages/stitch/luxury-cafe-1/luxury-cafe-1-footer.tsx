import { PageFooter } from '@/components/stitch/StitchLayout';

export function Footer() {
  return (
    <PageFooter
      brand="AURA CAFE"
      socialLinks={["IG", "FB", "TT"].map(s => ({ label: s }))}
      socialSize="sm"
    />
  );
}
