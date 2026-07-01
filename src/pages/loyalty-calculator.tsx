import { LoyaltyCalculator } from '@/components/loyalty/loyalty-calculator';
import { Link } from 'react-router-dom';

export function LoyaltyCalculatorPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-24">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
          AURA CAFE &bull; Sa Dec
        </div>
        <h1 className="mb-4 font-display text-3xl font-bold md:text-4xl">
          Bo Mo Phong Loyalty &amp; Tai Chinh
        </h1>
        <p className="mx-auto mb-6 max-w-2xl text-sm text-muted/60">
          Cong cu du toan dong tien, P&amp;L tuong tac dong ho tro chu quan ra quyet dinh chay
          chuong trinh Thanh vien (Loyalty), Khuyen mai (Vouchers), Hoan tien (Cashback).
        </p>

        <div className="flex flex-wrap justify-center gap-3 text-xs">
          <Link
            to="/loyalty"
            className="text-accent underline-offset-2 hover:underline"
          >
            Trang Loyalty Khach Hang
          </Link>
        </div>
      </div>

      {/* Calculator Component */}
      <LoyaltyCalculator />

      {/* Footer note */}
      <footer className="mt-16 text-center text-xs text-muted/40">
        <p>AURA CAFE Sa Dec &bull; He Thong Quan Ly Tai Chinh &amp; Van Hanh Tu Dong</p>
      </footer>
    </main>
  );
}
