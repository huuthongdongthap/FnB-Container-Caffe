import React from 'react';
import { Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

function guarded(element: React.ReactNode): React.ReactNode {
  return <ErrorBoundary>{element}</ErrorBoundary>;
}

const LuxuryLandingHero = React.lazy(() => import('@/pages/stitch/luxury-landing-hero'));
const LuxuryContainerCafe1 = React.lazy(() => import('@/pages/stitch/luxury-cafe-1'));
const LuxuryContainerCafe2 = React.lazy(() => import('@/pages/stitch/luxury-cafe-2'));
const LuxuryContainerLanding = React.lazy(() => import('@/pages/stitch/luxury-landing'));
const ReferralRewards2 = React.lazy(() => import('@/pages/stitch/referral-rewards-2'));
const EventsPromotions2 = React.lazy(() => import('@/pages/stitch/events-promotions-2'));

export const stitchRoutes = [
  <Route key="/stitch/landing" path="/stitch/landing" element={guarded(<LuxuryLandingHero />)} />,
  <Route key="/stitch/container-landing" path="/stitch/container-landing" element={guarded(<LuxuryContainerLanding />)} />,
  <Route key="/stitch/container-cafe-1" path="/stitch/container-cafe-1" element={guarded(<LuxuryContainerCafe1 />)} />,
  <Route key="/stitch/container-cafe-2" path="/stitch/container-cafe-2" element={guarded(<LuxuryContainerCafe2 />)} />,
  <Route key="/stitch/referral-2" path="/stitch/referral-2" element={guarded(<ReferralRewards2 />)} />,
  <Route key="/stitch/events-2" path="/stitch/events-2" element={guarded(<EventsPromotions2 />)} />,
];
