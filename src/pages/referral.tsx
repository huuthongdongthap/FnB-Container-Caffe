import { useReferralStore } from '@/hooks/stores/use-referral-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { ReferralLink } from '@/components/referral/referral-link';
import { ReferralStats } from '@/components/referral/referral-stats';
import { CashbackDisplay } from '@/components/referral/cashback-display';
import { Skeleton } from '@/components/ui';
import { Card } from '@/components/ui/card';
import { useEffect } from 'react';
import type { ReferralStat } from '@/components/referral/referral-stats';
import { Link, PartyPopper, User } from 'lucide-react';

export function ReferralPage() {
 const store = useReferralStore();
 const token = useAuthStore((s) => s.token);
 const isAuthenticated = !!token;

 useEffect(() => {
 if (isAuthenticated) {
 store.fetchReferralData();
 }
 }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

 const mappedReferrals: ReferralStat[] = store.recentReferrals.map((r) => ({
 id: r.id,
 referredName: r.referredName,
 status: r.status === 'completed' ? 'completed' : r.status === 'reversed' ? 'reversed' : 'pending',
 cashbackAwarded: r.cashbackAwarded,
 createdAt: r.createdAt,
 }));

 if (store.loading) {
 return (
 <div className="mx-auto max-w-4xl space-y-8 px-4 py-24">
 <Skeleton className="h-12 w-64" />
 <Skeleton className="h-8 w-96" />
 <Skeleton className="h-64 w-full" />
 <Skeleton className="h-48 w-full" />
 </div>
 );
 }

 return (
 <main className="bg-[#0A1A2E] text-[#e4e2e4] mx-auto max-w-4xl px-4 py-24">
 {/* Hero */}
 <section className="mb-16 text-center">
 <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#b8c7e2]">
 Referral Program
 </p>
 <h1 className="mb-4 font-[EB_Garamond,serif] text-4xl font-bold md:text-5xl">
 Moi Ban Be
 <br />
 <em className="bg-gradient-to-r from-accent to-accent-warm bg-clip-text not-italic text-transparent">
 Nhan Qua Kep
 </em>
 </h1>
 <p className="mx-auto mb-8 max-w-lg text-[#b8c7e2]/70">
 Chia se ma gioi thieu cua ban — ban nhan <strong>10.000d</strong> tien cashback cho moi
 ban be moi co don hang dau tien. Khong gioi han so lan!
 </p>
 <div className="flex flex-wrap justify-center gap-4">
 <a
 href="#how-it-works"
 className="inline-flex items-center gap-2 rounded-full bg-[#b8c7e2] px-8 py-3 text-sm font-semibold text-[#0A1A2E] transition-all hover:scale-105 hover:shadow-lg"
 >
 Cach Thuc Hoat Dong &rarr;
 </a>
 <a
 href="#referral-code"
 className="inline-flex items-center gap-2 rounded-full border border-white/[0.2] px-8 py-3 text-sm font-semibold text-[#b8c7e2] transition-all hover:bg-[#b8c7e2]/10"
 >
 Ma Gioi Thieu
 </a>
 </div>
 </section>

 {/* Section 1: How It Works */}
 <section id="how-it-works" className="mb-16">
 <div className="mb-12 text-center">
 <p className="mb-1 text-xs font-semibold tracking-[0.15em] text-[#b8c7e2]/70">01</p>
 <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#b8c7e2]">
 CACH THUC HOAT DONG
 </p>
 <h2 className="mb-3 font-[EB_Garamond,serif] text-3xl font-bold">3 Buoc Don Gian</h2>
 <p className="mx-auto max-w-md text-sm text-[#b8c7e2]/60">
 Chia se ma gioi thieu, ban be dang ky va ca hai ben deu nhan thuong ngay lap tuc.
 </p>
 </div>

 <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3">
 {/* Connector line */}
 <div className="absolute left-1/2 top-12 hidden h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-accent/20 via-accent/40 to-accent/20 md:block" />

 <Card className="relative p-6 text-center">
 <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.1] bg-[#b8c7e2]/5">
 <span className="text-3xl"><Link size={24} className="inline" /></span>
 <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#b8c7e2] text-xs font-bold text-[#0A1A2E]">
 1
 </span>
 </div>
 <h3 className="font-[EB_Garamond,serif] text-lg font-bold">Chia Se Ma Cua Ban</h3>
 <p className="mt-2 text-sm text-[#b8c7e2]/60">
 Sao chep ma gioi thieu duy nhat cua ban hoac chia se link dang ky truc tiep qua Zalo,
 Messenger hoac Instagram.
 </p>
 </Card>

 <Card className="relative p-6 text-center">
 <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.1] bg-[#b8c7e2]/5">
 <span className="text-3xl"><User size={24} className="inline" /></span>
 <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#b8c7e2] text-xs font-bold text-[#0A1A2E]">
 2
 </span>
 </div>
 <h3 className="font-[EB_Garamond,serif] text-lg font-bold">Ban Be Dang Ky</h3>
 <p className="mt-2 text-sm text-[#b8c7e2]/60">
 Ban be dang ky tai khoan AURA CAFE bang ma gioi thieu va hoan thanh don hang dau tien
 tai quan.
 </p>
 </Card>

 <Card className="relative p-6 text-center">
 <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.1] bg-[#b8c7e2]/5">
 <span className="text-3xl"><PartyPopper size={24} className="inline" /></span>
 <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#b8c7e2] text-xs font-bold text-[#0A1A2E]">
 3
 </span>
 </div>
 <h3 className="font-[EB_Garamond,serif] text-lg font-bold">Nhan Qua Tu Dong</h3>
 <p className="mt-2 text-sm text-[#b8c7e2]/60">
 Sau khi don hang dau tien thanh cong, ban nhan <strong>10.000d</strong> tien cashback
 tu dong vao vi.
 </p>
 </Card>
 </div>
 </section>

 {/* Section 2: Referral Code */}
 <section id="referral-code" className="mb-16">
 <div className="mb-12 text-center">
 <p className="mb-1 text-xs font-semibold tracking-[0.15em] text-[#b8c7e2]/70">02</p>
 <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#b8c7e2]">
 MA GIOI THIEU
 </p>
 <h2 className="mb-3 font-[EB_Garamond,serif] text-2xl font-bold">Ma Cua Ban</h2>
 </div>

 <ReferralLink
 code={store.referralCode ?? 'FNB-XXXXXX'}
 referralCount={store.referralCount}
 onApplyCode={(code) => store.applyReferralCode(code)}
 />
 </section>

 {/* Section 3: Rewards */}
 <section id="rewards" className="mb-16">
 <div className="mb-12 text-center">
 <p className="mb-1 text-xs font-semibold tracking-[0.15em] text-[#b8c7e2]/70">03</p>
 <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#b8c7e2]">
 PHAN THUONG
 </p>
 <h2 className="mb-3 font-[EB_Garamond,serif] text-2xl font-bold">Qua Tang Cho Nguoi Gioi Thieu</h2>
 </div>

 <div className="grid gap-8 md:grid-cols-2">
 <CashbackDisplay
 earnedAmount={store.cashbackEarned}
 totalReferrals={store.referralCount}
 />

 <ReferralStats
 totalReferrals={store.referralCount}
 totalCashbackEarned={store.cashbackEarned}
 codeUsage={store.codeUsage}
 recentReferrals={mappedReferrals}
 />
 </div>

 <p className="mx-auto mt-8 max-w-lg text-center text-xs text-[#b8c7e2]/40">
 Dieu khoan: Ma gioi thieu chi co hieu luc khi ban be moi hoan thanh don hang dau tien tai
 AURA CAFE (toi thieu 20.000d). Tien cashback duoc ghi vao vi tu dong trong vong 24 gio.
 </p>
 </section>
 </main>
 );
}
