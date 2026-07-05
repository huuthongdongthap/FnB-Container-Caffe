import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCheckinStore } from '@/hooks/stores/use-checkin-store';
import { CheckinForm } from '@/components/checkin/CheckinForm';
import { ApprovalStatus } from '@/components/checkin/ApprovalStatus';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Button } from '@/components/ui/button';
import { PartyPopper } from 'lucide-react';

export default function CheckinPage() {
 const { t } = useTranslation();
 const {
 checkinResult,
 loading,
 error,
 submitCheckin,
 reset,
 } = useCheckinStore();

 // wire store result into page-level state
 const handlePhoneSubmit = async (phone: string) => {
 await submitCheckin(phone);
 };

 const stateStep = checkinResult ? 5 : 1;

 return (
 <>
  <HelmetHead
    title={t('checkin.seoTitle')}
    description={t('checkin.seoDescription')}
    canonical="/checkin"
  />
  <div className="min-h-screen bg-[color:var(--aura-noir-deep)] py-12 px-4">
 <div className="max-w-md mx-auto">
 {/* Logo */}
 <div className="text-center mb-8">
 <h1 className="text-3xl font-display font-bold">AURA</h1>
 <p className="text-xs text-[color:var(--aura-chrome-bright)] uppercase tracking-widest">
 {t('checkin.containerRooftop')}
 </p>
 </div>

 {/* Error banner */}
 {error && (
 <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-200 text-red-700 text-sm">{error}</div>
 )}

 {/* Step 1: Enter phone */}
 {stateStep === 1 && !checkinResult && (
 <div>
 <div className="flex items-center gap-3 mb-4">
 <span className="w-8 h-8 rounded-full bg-[color:var(--aura-noir-deep)] text-[color:var(--aura-chrome-bright)] flex items-center justify-center text-sm font-bold">1</span>
 <div>
 <h2 className="font-display text-lg font-semibold">{t('checkin.enterPhone')}</h2>
 <p className="text-xs text-[color:var(--aura-chrome-bright)]">{t('checkin.enterPhoneDescription')}</p>
 </div>
 </div>
 <CheckinForm
 onSubmit={handlePhoneSubmit}
 />
 <p className="text-center text-xs text-[color:var(--aura-chrome-bright)] mt-4">
 {t('checkin.notMember')}{' '}
 <a href="/signup" className="text-[color:var(--aura-forest-primary)] hover:underline">
 {t('checkin.registerNow')}
 </a>
 </p>
 </div>
 )}

 {/* Loading state */}
 {loading && (
 <div className="flex items-center justify-center gap-2 text-sm text-[color:var(--aura-chrome-bright)] py-8">
 <span className="w-4 h-4 border-2 border-white/[0.08] border-t-transparent rounded-full animate-spin" />
 {t('checkin.processing')}
 </div>
 )}

 {/* Step 5: Success */}
 {stateStep === 5 && checkinResult && (
 <div>
 <div className="p-6 rounded-xl border-2 border-green-500 text-center">
 <div className="text-5xl mb-3"><PartyPopper size={36} className="inline" /></div>
 <h2 className="font-display text-xl font-bold mb-2">{t('checkin.thanksCheckin')}</h2>
 {checkinResult.points > 0 && (
 <div>
 <p className="text-2xl font-bold text-green-600">+{checkinResult.points.toLocaleString()}đ</p>
 <p className="text-sm text-[color:var(--aura-chrome-bright)]">{t('checkin.addedToWallet')}</p>
 </div>
 )}
 {checkinResult.reward && checkinResult.points === 0 && (
 <div>
 <p className="text-2xl font-bold text-green-600">{checkinResult.reward}</p>
 </div>
 )}
 {checkinResult.points === 0 && !checkinResult.reward && (
 <p className="text-sm text-[color:var(--aura-chrome-bright)]">{t('checkin.checkinSuccess')}</p>
 )}
 </div>
 <Button className="w-full mt-4" onClick={reset}>
 {t('checkin.close')}
 </Button>
 </div>
 )}
 </div>
 </div>
 </>
 );
}
