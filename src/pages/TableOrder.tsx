'use client';

import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { StitchMobileOrderNew } from '@/components/stitch';
import type { MenuItem } from '@/components/stitch/StitchMobileOrderNew-types';
import { useOrderStoreWithOfflineFlush } from '@/hooks/stores/use-order-store';
import { isTableIdValid, validateCustomerForm } from './TableOrder-utils';
import {
  GuestInfoForm,
  OfflineIndicator,
} from './TableOrder-components';
import { useHandleViewCart } from './TableOrder-hooks';
import { LandingNav } from '@/components/stitch/StitchLandingNew-nav';
import { LandingFooter } from '@/components/stitch/StitchLandingNew-footer';
import { UtensilsCrossed, ArrowRight, MapPin, Coffee, Sparkles } from 'lucide-react';

export type { CartItem } from '@/components/stitch';

/* ═══════════════════════════════════════════════════════════════════
 * Authentic Vietnamese Sa Đéc Menu for Table Ordering
 * ═══════════════════════════════════════════════════════════════════ */
const AURA_VI_ORDER_ITEMS: MenuItem[] = [
  {
    id: 'tc001',
    name: 'Cà phê máy / phin truyền thống',
    description: 'Robusta Đắk Lắk nguyên chất rang mộc, đậm đà chuẩn gu Việt.',
    price: 20000,
    priceLabel: '20.000₫',
    category: 'coffee',
    badge: 'Truyền Thống',
    featured: true,
    imageSrc: '/photos/IMG_6593.webp',
    imageAlt: 'Cà phê đen nguyên chất AURA CAFE',
  },
  {
    id: 'tc002',
    name: 'Cà phê sữa máy / phin',
    description: 'Sự kết hợp hoàn hảo giữa cà phê đậm vị và sữa đặc béo ngậy truyền thống.',
    price: 25000,
    priceLabel: '25.000₫',
    category: 'coffee',
    badge: 'Bán Chạy',
    featured: true,
    imageSrc: '/photos/IMG_6581.webp',
    imageAlt: 'Cà phê sữa đá pha máy AURA CAFE',
  },
  {
    id: 'tc003',
    name: 'Cà phê muối AURA',
    description: 'Lớp kem béo mặn hòa quyện cùng cốt cà phê thơm lừng, món đặc sản được yêu thích nhất.',
    price: 28000,
    priceLabel: '28.000₫',
    category: 'signature',
    badge: 'Đặc Sản',
    featured: true,
    imageSrc: '/photos/IMG_6554-frame.webp',
    imageAlt: 'Cà phê muối AURA CAFE',
  },
  {
    id: 'tc004',
    name: 'Bạc xỉu đá',
    description: 'Vị ngọt dịu thơm béo từ sữa tươi và sữa đặc, thoảng nhẹ hương cà phê tinh tế.',
    price: 28000,
    priceLabel: '28.000₫',
    category: 'coffee',
    imageSrc: '/photos/IMG_6555-frame.webp',
    imageAlt: 'Bạc xỉu đá thơm béo',
  },
  {
    id: 'hc003',
    name: 'Cappuccino bọt sữa Ý',
    description: 'Espresso nóng phủ lớp bọt sữa dày mịn như nhung, rắc nhẹ bột ca cao thơm ấm.',
    price: 35000,
    priceLabel: '35.000₫',
    category: 'coffee',
    imageSrc: '/photos/IMG_6564.webp',
    imageAlt: 'Ly Cappuccino tạo hình nghệ thuật',
  },
  {
    id: 'fp004',
    name: 'Cà phê Dừa Việt quất đá xay',
    description: 'Món signature sáng tạo: cà phê dừa béo thơm quyện vị việt quất chua ngọt tươi mát.',
    price: 35000,
    priceLabel: '35.000₫',
    category: 'signature',
    badge: 'Signature',
    featured: true,
    imageSrc: '/photos/IMG_6693.webp',
    imageAlt: 'Cà phê dừa đá xay độc bản',
  },
  {
    id: 'te006',
    name: 'Trà đào thanh mát',
    description: 'Cốt trà thơm lừng kết hợp miếng đào giòn sần sật và nước cốt đào chua ngọt giải nhiệt.',
    price: 30000,
    priceLabel: '30.000₫',
    category: 'tea',
    badge: 'Phổ Biến',
    featured: true,
    imageSrc: '/photos/IMG_6556-frame.webp',
    imageAlt: 'Ly trà đào thanh mát',
  },
  {
    id: 'sm002',
    name: 'Sinh tố Bơ sáp dẻo',
    description: 'Bơ sáp chọn lọc xay cùng sữa đặc và đá nhuyễn, béo ngậy và giàu dinh dưỡng.',
    price: 35000,
    priceLabel: '35.000₫',
    category: 'signature',
    badge: 'Bán Chạy',
    imageSrc: '/photos/IMG_6699.webp',
    imageAlt: 'Sinh tố bơ tươi sánh mịn',
  },
  {
    id: 'sd001',
    name: 'Soda Sapphire Blue Curacao',
    description: 'Soda xanh biển đại dương rực rỡ, vị chanh thơm sảng khoái và gas mát lạnh.',
    price: 25000,
    priceLabel: '25.000₫',
    category: 'signature',
    imageSrc: '/photos/IMG_6696.webp',
    imageAlt: 'Ly soda màu xanh đại dương mát lạnh',
  },
  {
    id: 'jc006',
    name: 'Cam vắt tươi nguyên chất',
    description: '100% cam sành miền Tây vắt tươi tại chỗ, giữ trọn vẹn vitamin C tự nhiên.',
    price: 23000,
    priceLabel: '23.000₫',
    category: 'tea',
    imageSrc: '/photos/IMG_6565.webp',
    imageAlt: 'Nước cam vắt tươi nguyên chất',
  },
];

/* 5 Authentic Container Zones */
const ZONES_FOR_TABLES = [
  { id: 1, name: 'Quầy Bar Container (Tầng trệt)', tables: ['01', '02', '03', '04'] },
  { id: 2, name: 'Lounge Thủy Mộc (Bàn lớn)', tables: ['05', '06', '07', '08'] },
  { id: 3, name: 'Sân Thượng Rooftop (Tầng 2)', tables: ['09', '10', '11', '12'] },
  { id: 4, name: 'Cabin Yên Tĩnh (Làm việc)', tables: ['13', '14', '15', '16'] },
  { id: 5, name: 'Khu Sân Vườn Ngoài Trời', tables: ['17', '18', '19', '20'] },
];

export function TableOrder(): ReactNode {
  const { t } = useTranslation('order');
  const navigate = useNavigate();
  const location = useLocation();
  const isPosRoute = location.pathname.startsWith('/pos');
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTable = searchParams.get('table') || searchParams.get('ban');
  const tableId = rawTable?.trim() ?? '';
  const hasValidTable = isTableIdValid(rawTable);

  const queuedOffline = useOrderStoreWithOfflineFlush((s) => s.queuedOffline);

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSelectTable = (selected: string) => {
    setSearchParams({ table: selected });
  };

  const handleViewCart = useHandleViewCart({
    tableId,
    hasValidTable,
    guestName,
    guestPhone,
    isSubmitting,
    queuedOffline,
    submitError,
    setIsSubmitting,
    setSubmitError,
    validateCustomerForm: () => {
      const result = validateCustomerForm(guestName, guestPhone, t);
      if (!result.valid) setSubmitError(result.error ?? null);
      return result.valid;
    },
  });

  const clearError = useCallback(() => {
    if (submitError) setSubmitError(null);
  }, [submitError]);

  /* If no valid table selected, render Container Table Selection Screen */
  if (!hasValidTable) {
    return (
      <div className="min-h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)] font-body flex flex-col justify-between selection:bg-[var(--aura-chrome-mid)] selection:text-[var(--aura-noir-deep)]">
        {isPosRoute ? (
          <header className="py-4 px-6 bg-white/5 border-b border-white/10 flex items-center justify-between">
            <span className="font-display font-bold text-sm tracking-wider uppercase text-white">
              AURA POS • CHỌN BÀN PHỤC VỤ
            </span>
            <button
              type="button"
              onClick={() => navigate('/admin/pos')}
              className="text-xs text-[var(--aura-chrome-mid)] hover:underline uppercase tracking-wider"
            >
              Về POS quầy →
            </button>
          </header>
        ) : (
          <LandingNav />
        )}

        <main className={`${isPosRoute ? 'pt-8' : 'pt-28'} pb-20 px-5 max-w-4xl mx-auto w-full`}>
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-widest uppercase bg-[var(--aura-forest-light)]/20 text-[var(--aura-forest-light)] border border-[var(--aura-forest-light)]/30 mb-3">
              <Sparkles className="w-3.5 h-3.5" /> AURA CAFE SA ĐÉC • GỌI MÓN TẬN BÀN
            </span>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3">
              Chọn Bàn Bạn Đang Ngồi
            </h1>
            <p className="text-sm sm:text-base text-[var(--aura-chrome-mid)] max-w-xl mx-auto">
              Quán gồm 3 khối container chia thành 5 khu vực trải nghiệm. Vui lòng chạm vào số bàn trên thẻ bàn của bạn để gọi món:
            </p>
          </div>

          <div className="space-y-6">
            {ZONES_FOR_TABLES.map((zone) => (
              <div
                key={zone.id}
                className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-[var(--aura-chrome-mid)]/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-[var(--aura-chrome-mid)]" />
                  <h2 className="text-base font-semibold text-white font-display">
                    {zone.name}
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {zone.tables.map((tNum) => (
                    <button
                      key={tNum}
                      type="button"
                      onClick={() => handleSelectTable(tNum)}
                      className="py-3 px-4 rounded-xl font-display font-bold text-base text-center transition-all bg-white/[0.05] hover:bg-[var(--aura-chrome-mid)] hover:text-white border border-white/10 hover:border-transparent active:scale-95 shadow-md flex items-center justify-center gap-2"
                    >
                      <UtensilsCrossed className="w-4 h-4 opacity-70" />
                      Bàn {tNum}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/menu')}
              className="px-6 py-3 rounded-full text-sm font-semibold tracking-wider uppercase bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-2"
            >
              <Coffee className="w-4 h-4" /> Xem Thực Đơn Mang Về / Đặt Online
            </button>
            <button
              type="button"
              onClick={() => navigate('/table-reservation')}
              className="px-6 py-3 rounded-full text-sm font-semibold tracking-wider uppercase border border-[var(--aura-chrome-mid)] text-[var(--aura-chrome-mid)] hover:bg-[var(--aura-chrome-mid)]/10 transition-all flex items-center gap-2"
            >
              Đặt Bàn Trước <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </main>

        {!isPosRoute && <LandingFooter />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)] font-body selection:bg-[var(--aura-chrome-mid)] selection:text-[var(--aura-noir-deep)]">
      <HelmetHead
        title={t('seoTitle', { defaultValue: `Gọi Món Bàn ${tableId} — AURA CAFE` })}
        description={t('seoDescription', {
          defaultValue: `Đặt món trực tiếp tại bàn ${tableId} — Cà phê container Sa Đéc.`,
        })}
        canonical={`/order?table=${encodeURIComponent(tableId)}`}
      />

      {isPosRoute ? (
        <header className="py-3 px-6 bg-white/5 border-b border-white/10 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
          <span className="font-display font-bold text-sm tracking-wider uppercase text-white">
            AURA POS • BÀN {tableId}
          </span>
          <button
            type="button"
            onClick={() => navigate('/pos/table/select')}
            className="text-xs text-[var(--aura-chrome-mid)] hover:underline uppercase tracking-wider"
          >
            Đổi bàn
          </button>
        </header>
      ) : (
        <LandingNav />
      )}

      {/* Table & Guest Information Bar */}
      <GuestInfoForm
        guestName={guestName}
        guestPhone={guestPhone}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onNameChange={(v) => { setGuestName(v); clearError(); }}
        onPhoneChange={(v) => { setGuestPhone(v); clearError(); }}
      />

      {!isPosRoute && <div style={{ height: '7.5rem' }} aria-hidden="true" />}
      {queuedOffline && <OfflineIndicator />}

      <StitchMobileOrderNew
        items={AURA_VI_ORDER_ITEMS}
        tableId={tableId}
        onViewCart={handleViewCart}
      />

      {!isPosRoute && <LandingFooter />}
    </div>
  );
}

export default TableOrder;
