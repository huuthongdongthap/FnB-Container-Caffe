import { LoyaltyCalculator } from '@/components/loyalty/loyalty-calculator';
import { Link } from 'react-router-dom';

export function LoyaltyCalculatorPage() {
 return (
 <main className="bg-[#0A1A2E] text-[#e4e2e4] mx-auto max-w-5xl px-4 py-24">
 {/* Header */}
 <div className="mb-10 text-center">
 <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.15] px-4 py-1 text-xs font-semibold uppercase tracking-wider text-[#b8c7e2]">
 AURA CAFE &bull; Sa Dec
 </div>
 <h1 className="mb-4 font-[EB_Garamond,serif] text-3xl font-bold md:text-4xl">
 Bo Mo Phong Loyalty &amp; Tai Chinh
 </h1>
 <p className="mx-auto mb-6 max-w-2xl text-sm text-[#b8c7e2]/60">
 Cong cu du toan dong tien, P&amp;L tuong tac dong ho tro chu quan ra quyet dinh chay
 chuong trinh Thanh vien (Loyalty), Khuyen mai (Vouchers), Hoan tien (Cashback).
 </p>

 <div className="flex flex-wrap justify-center gap-3 text-xs">
 <Link
 to="/loyalty"
 className="text-[#b8c7e2] underline-offset-2 hover:underline"
 >
 Trang Loyalty Khach Hang
 </Link>
 </div>
 </div>

 {/* Calculator Component */}
 <LoyaltyCalculator />

 {/* Footer note */}
 <footer className="mt-16 text-center text-xs text-[#b8c7e2]/40">
 <p>AURA CAFE Sa Dec &bull; He Thong Quan Ly Tai Chinh &amp; Van Hanh Tu Dong</p>
 </footer>
 </main>
 );
}
