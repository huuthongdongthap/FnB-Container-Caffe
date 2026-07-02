import { HelmetHead } from '@/components/seo/HelmetHead';
import { useLoyaltyStore } from '@/hooks/stores/use-loyalty-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { getNextTier } from '@/hooks/use-loyalty';
import { TierCard } from '@/components/loyalty/tier-card';
import { TierProgress } from '@/components/loyalty/tier-progress';
import { RewardsGrid } from '@/components/loyalty/rewards-grid';
import { PointsHistory } from '@/components/loyalty/points-history';
import { BirthdayReward } from '@/components/loyalty/birthday-reward';
import { CheckinTracker } from '@/components/loyalty/checkin-tracker';
import { Card, Skeleton } from '@/components/ui';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';

const TIERS = [
 {
 rank: 'Dong',
 tier: 'bronze',
 minPoints: 0,
 cashbackRate: 3,
 pointsMultiplier: 1.0,
 benefits: ['Tich diem x1.0', 'Hoan tien 3%', 'Sinh nhat 10%', 'Uu tien order'],
 },
 {
 rank: 'Bac',
 tier: 'silver',
 minPoints: 50,
 cashbackRate: 5,
 pointsMultiplier: 1.1,
 benefits: ['Tich diem x1.1', 'Hoan tien 5%', 'Sinh nhat 10%', 'Free upgrade size', 'Uu tien order'],
 },
 {
 rank: 'Vang',
 tier: 'gold',
 minPoints: 200,
 cashbackRate: 7,
 pointsMultiplier: 1.3,
 benefits: ['Tich diem x1.3', 'Hoan tien 7%', 'Sinh nhat 15%', 'Free upgrade size', 'Uu tien Rooftop'],
 },
 {
 rank: 'Bach Kim',
 tier: 'platinum',
 minPoints: 500,
 cashbackRate: 10,
 pointsMultiplier: 1.5,
 benefits: ['Tich diem x1.5', 'Hoan tien 10%', 'Sinh nhat 20% + Qua', 'Qua hang thang', 'Uu tien VIP'],
 },
];

export function LoyaltyPage() {
 const store = useLoyaltyStore();
 const token = useAuthStore((s) => s.token);
 const isAuthenticated = !!token;

 useEffect(() => {
 if (isAuthenticated) {
 store.fetchLoyalty();
 }
 }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

 if (store.loading) {
 return (
 <div className="mx-auto max-w-6xl space-y-8 px-4 py-24">
 <Skeleton className="h-12 w-64" />
 <Skeleton className="h-8 w-96" />
 <Skeleton className="h-80 w-full" />
 </div>
 );
 }

 const currentPoints = store.points;
 const currentTier = store.tier;
 const nextTier = getNextTier(currentTier);
 const currentSpent = 0; // Not persisted in store; TierProgress defaults gracefully
 const hasBirthday = false; // Birthday data from API not stored; BirthdayReward handles empty state

 return (
 <>
 <HelmetHead
 title="Khách hàng thân thiết"
 description="Chương trình khách hàng thân thiết AURA CAFE — 4 hạng Bronze, Silver, Gold, Platinum. Tích điểm, nhận cashback, ưu đãi sinh nhật."
 canonical="/loyalty"
 />
 <main className="mx-auto max-w-6xl px-4 py-24">
 {/* Hero */}
 <section className="mb-16 text-center">
 <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#b8c7e2]">
 AURA Loyalty
 </p>
 <h1 className="mb-4 font-[EB_Garamond,serif] text-4xl font-bold md:text-5xl">
 Uong Ca Phe
 <br />
 <em className="bg-gradient-to-r from-accent to-accent-warm bg-clip-text not-italic text-transparent">
 Tich Diem, Doi Qua
 </em>
 </h1>
 <p className="mx-auto mb-8 max-w-lg text-[#b8c7e2]/70">
 Chuong trinh thanh vien AURA CAFE — 4 hang thanh vien, cashback len toi 10%, qua tang
 dac biet moi thang. Cang uong cang loi!
 </p>
 <div className="flex flex-wrap justify-center gap-4">
 <a
 href="#tiers"
 className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-sm font-semibold text-[#0A1A2E] transition-all hover:scale-105 hover:shadow-lg"
 >
 Xem Hang Thanh Vien &rarr;
 </a>
 <Link
 to="/loyalty-calculator"
 className="inline-flex items-center gap-2 rounded-full border border-white/[0.2] px-8 py-3 text-sm font-semibold text-[#b8c7e2] transition-all hover:bg-[#b8c7e2]/10"
 >
 Mo Phong Tai Chinh
 </Link>
 </div>
 </section>

 {/* Section 1: Tier System */}
 <section id="tiers" className="mb-16">
 <div className="mb-12 text-center">
 <p className="mb-1 text-xs font-semibold tracking-[0.15em] text-[#b8c7e2]/70">01</p>
 <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#b8c7e2]">
 HANG THANH VIEN
 </p>
 <h2 className="mb-3 font-[EB_Garamond,serif] text-3xl font-bold">4 Hang — Cang Uong Cang Loi</h2>
 <p className="mx-auto max-w-md text-sm text-[#b8c7e2]/60">
 Moi don hang deu duoc hoan tien theo hang thanh vien. Len hang de nhan them uu dai dac quyen.
 </p>
 </div>

 <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
 {TIERS.map((tier) => (
 <TierCard
 key={tier.tier}
 {...tier}
 isCurrent={tier.tier === currentTier}
 currentPoints={tier.tier === currentTier ? currentPoints : undefined}
 pointsToNext={
 tier.tier === currentTier && nextTier
 ? nextTier.minPoints - currentPoints
 : undefined
 }
 />
 ))}
 </div>
 </section>

 {/* Section 2: How to Earn */}
 <section className="mb-16 rounded-2xl bg-gradient-to-b from-muted/5 to-transparent px-4 py-12">
 <div className="mx-auto max-w-4xl">
 <div className="mb-12 text-center">
 <p className="mb-1 text-xs font-semibold tracking-[0.15em] text-[#b8c7e2]/70">02</p>
 <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#b8c7e2]">
 CACH TICH DIEM
 </p>
 <h2 className="mb-3 font-[EB_Garamond,serif] text-3xl font-bold">Moi Ly — Mot Diem</h2>
 <p className="mx-auto max-w-md text-sm text-[#b8c7e2]/60">
 Nhieu cach de tich diem va nhan thuong. Cang uong nhieu, cang nhan nhieu!
 </p>
 </div>

 <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
 <Card className="p-6 text-center">
 <span className="mb-3 block text-3xl">&#9749;</span>
 <h4 className="font-[EB_Garamond,serif] text-base font-bold">Mua Tai Quan</h4>
 <p className="mt-1 text-xs text-[#b8c7e2]/60">
 Moi don hang tai quan duoc tinh diem theo tong gia tri.
 </p>
 <p className="mt-2 font-[EB_Garamond,serif] text-lg font-bold text-[#b8c7e2]">
 x1.0 — x1.5 diem
 </p>
 </Card>
 <Card className="p-6 text-center">
 <span className="mb-3 block text-3xl">&#128591;</span>
 <h4 className="font-[EB_Garamond,serif] text-base font-bold">Check-In</h4>
 <p className="mt-1 text-xs text-[#b8c7e2]/60">
 Check-in tai AURA tren Zalo hoac Facebook de nhan diem thuong.
 </p>
 <p className="mt-2 font-[EB_Garamond,serif] text-lg font-bold text-[#b8c7e2]">
 +10 diem / lan
 </p>
 </Card>
 <Card className="p-6 text-center">
 <span className="mb-3 block text-3xl">&#127874;</span>
 <h4 className="font-[EB_Garamond,serif] text-base font-bold">Sinh Nhat</h4>
 <p className="mt-1 text-xs text-[#b8c7e2]/60">
 Ngay sinh nhat nhan voucher giam gia dac biet va qua tang.
 </p>
 <p className="mt-2 font-[EB_Garamond,serif] text-lg font-bold text-[#b8c7e2]">
 10% — 20% off
 </p>
 </Card>
 <Card className="p-6 text-center">
 <span className="mb-3 block text-3xl">&#128279;</span>
 <h4 className="font-[EB_Garamond,serif] text-base font-bold">Gioi Thieu Ban Be</h4>
 <p className="mt-1 text-xs text-[#b8c7e2]/60">
 Chia se ma gioi thieu — ca ban va ban be moi deu nhan 10.000d cashback.
 </p>
 <p className="mt-2 font-[EB_Garamond,serif] text-lg font-bold text-[#b8c7e2]">
 +10.000 d / nguoi
 </p>
 </Card>
 </div>
 </div>
 </section>

 {/* Section 3: Rewards + User Dashboard */}
 <section id="rewards" className="mb-16">
 <div className="mb-12 text-center">
 <p className="mb-1 text-xs font-semibold tracking-[0.15em] text-[#b8c7e2]/70">03</p>
 <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#b8c7e2]">
 DANH MUC QUA TANG
 </p>
 <h2 className="mb-3 font-[EB_Garamond,serif] text-3xl font-bold">Doi Diem — Nhan Qua</h2>
 <p className="mx-auto max-w-md text-sm text-[#b8c7e2]/60">
 Su dung diem loyalty de doi do uong, qua tang va uu dai dac biet.
 </p>
 </div>

 <div className="grid gap-8 lg:grid-cols-3">
 <div className="lg:col-span-2">
 <RewardsGrid
 rewards={store.rewards}
 userPoints={currentPoints}
 onRedeem={(id) => store.redeemReward(id)}
 />
 </div>
 <div className="space-y-6">
 <TierProgress
 currentTier={TIERS.find((t) => t.tier === currentTier)?.rank ?? 'Dong'}
 nextTier={nextTier?.rank ?? null}
 currentSpent={currentSpent}
 nextTierThreshold={nextTier ? nextTier.minPoints * 10000 : null}
 />
 <BirthdayReward hasBirthday={hasBirthday} bonusPercent={10} />
 <CheckinTracker streak={0} todayChecked={false} />
 </div>
 </div>
 </section>

 {/* Points History */}
 <section className="mb-16">
 <PointsHistory entries={store.history} />
 </section>

 {/* Calculator CTA */}
 <section className="mb-16">
 <Card className="mx-auto max-w-lg border border-white/[0.15] p-10 text-center">
 <h3 className="mb-3 font-[EB_Garamond,serif] text-2xl font-bold">
 Tinh Toan Loi Nhuan Cua Ban
 </h3>
 <p className="mb-6 text-sm text-[#b8c7e2]/60">
 Cong cu mo phong tai chinh tuong tac giup ban tinh toan cashback, tich diem va loi nhuan
 theo tung hang thanh vien.
 </p>
 <Link
 to="/loyalty-calculator"
 className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-sm font-semibold text-[#0A1A2E] transition-all hover:scale-105 hover:shadow-lg"
 >
 Mo Bo Mo Phong Tai Chinh &rarr;
 </Link>
 </Card>
 </section>
 </main>
 </>
 );
}
