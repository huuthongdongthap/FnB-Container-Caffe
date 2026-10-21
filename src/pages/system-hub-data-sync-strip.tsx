'use client';

import { Zap } from 'lucide-react';

/** Explainer strip showing the five-hop realtime data flow. */
export function DataSyncArchitectureStrip() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 mb-8">
      <div className="rounded-xl border border-[#6B9FB8]/30 bg-gradient-to-r from-[#0C1F33] via-[#0A1A2E] to-[#0C1F33] p-4 sm:p-5 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            <h3 className="font-display text-sm font-bold text-white tracking-wide uppercase">
              Luồng Dữ Liệu Đồng Bộ Thời Gian Thực (Single Source of Truth)
            </h3>
          </div>
          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Dữ liệu trang chính ↔ KDS ↔ POS ↔ Admin hoàn toàn liên kết
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 text-xs">
          <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex flex-col justify-between">
            <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center font-bold">1</span>
              Khách Gọi Món
            </div>
            <p className="text-[11px] text-[var(--aura-text-secondary,#a0a8b0)]">
              Khách chọn món trên menu <code>/menu</code> hoặc quét QR bàn. Món được lưu vào giỏ hàng Zustand.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex flex-col justify-between">
            <div className="font-semibold text-cyan-300 mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-bold">2</span>
              Gửi Đơn & PayOS
            </div>
            <p className="text-[11px] text-[var(--aura-text-secondary,#a0a8b0)]">
              Khách thanh toán tại <code>/checkout</code>. Mutation POST <code>/api/orders</code> ghi đơn vào SQLite/D1.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex flex-col justify-between">
            <div className="font-semibold text-emerald-300 mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-bold">3</span>
              KDS Bếp Nhận Vé
            </div>
            <p className="text-[11px] text-[var(--aura-text-secondary,#a0a8b0)]">
              Màn hình <code>/kds</code> lập tức nhận SSE stream, chuông vang lên và đồng hồ đếm ngược bắt đầu chạy.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex flex-col justify-between">
            <div className="font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] flex items-center justify-center font-bold">4</span>
              Bàn & Thu Ngân
            </div>
            <p className="text-[11px] text-[var(--aura-text-secondary,#a0a8b0)]">
              <code>/admin/table-management</code> đổi màu bàn sang Có Khách. POS thu ngân in hóa đơn tức thì.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex flex-col justify-between">
            <div className="font-semibold text-purple-300 mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] flex items-center justify-center font-bold">5</span>
              CRM & Báo Cáo
            </div>
            <p className="text-[11px] text-[var(--aura-text-secondary,#a0a8b0)]">
              Hồ sơ khách tại <code>/admin/customers</code> được cộng điểm. Dashboard cập nhật doanh thu và top món.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
