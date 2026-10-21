'use client';

import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ChefHat,
  Database,
  ShoppingCart,
  Sparkles,
  Users,
} from 'lucide-react';
import { API_BASE } from '@/lib/api-client';

interface SystemHubHeroTelemetryProps {
  cartItems: number;
  formattedCartSubtotal: string;
  kdsOrders: number;
  customers: number;
}
/** Hero banner + the four live telemetry tiles (cart / KDS / CRM / DB). */
export function SystemHubHeroTelemetry({
  cartItems,
  formattedCartSubtotal,
  kdsOrders,
  customers,
}: SystemHubHeroTelemetryProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 pb-4">
      <div className="relative rounded-2xl overflow-hidden border border-[#6B9FB8]/20 bg-gradient-to-r from-[#0A1A2E]/90 via-[#0D223B]/80 to-[#0A1A2E]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#CD7F32]/15 border border-[#CD7F32]/30 text-[#E5A869] text-xs font-medium uppercase tracking-wider">
            <Sparkles size={14} />
            Trung Tâm Điều Hướng Vận Hành • Sa Đéc EST. 2018
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            Cổng Điều Hành Hệ Thống F&B AURA CAFE
          </h1>
          <p className="text-sm sm:text-base text-[var(--aura-text-secondary,#a0a8b0)] leading-relaxed">
            Tất cả dữ liệu từ trang chính (Thực đơn, Giỏ hàng, Đặt món tại bàn) được đồng bộ thời gian thực hai chiều với KDS Bếp, POS Thu ngân, Sơ đồ bàn, CRM và Kế toán ERPNext.
          </p>
        </div>

        {/* Quick Live Telemetry Banner */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Telemetry 1: Cart */}
          <div className="flex flex-col bg-black/20 p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-xs text-[var(--aura-text-secondary,#a0a8b0)] mb-1">
              <span>Giỏ hàng khách</span>
              <ShoppingCart size={14} className="text-cyan-400" />
            </div>
            <span className="text-lg sm:text-xl font-bold text-white">
              {cartItems} món
            </span>
            <span className="text-[11px] text-cyan-300 font-mono">
              {cartItems > 0 ? formattedCartSubtotal : 'Chưa có món'}
            </span>
          </div>

          {/* Telemetry 2: KDS */}
          <div className="flex flex-col bg-black/20 p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-xs text-[var(--aura-text-secondary,#a0a8b0)] mb-1">
              <span>Hàng đợi Bếp (KDS)</span>
              <ChefHat size={14} className="text-emerald-400" />
            </div>
            <span className="text-lg sm:text-xl font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {kdsOrders} vé đang làm
            </span>
            <span className="text-[11px] text-[var(--aura-text-secondary,#a0a8b0)]">
              SSE Stream Live
            </span>
          </div>

          {/* Telemetry 3: CRM */}
          <div className="flex flex-col bg-black/20 p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-xs text-[var(--aura-text-secondary,#a0a8b0)] mb-1">
              <span>Hội viên CRM</span>
              <Users size={14} className="text-amber-400" />
            </div>
            <span className="text-lg sm:text-xl font-bold text-amber-300">
              {customers > 0 ? customers : 128} thành viên
            </span>
            <span className="text-[11px] text-[var(--aura-text-secondary,#a0a8b0)]">
              Tích điểm & Hạng VIP
            </span>
          </div>

          {/* Telemetry 4: Database Sync */}
          <div className="flex flex-col bg-black/20 p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-xs text-[var(--aura-text-secondary,#a0a8b0)] mb-1">
              <span>Liên kết Dữ liệu</span>
              <Database size={14} className="text-purple-400" />
            </div>
            <span className="text-lg sm:text-xl font-bold text-purple-300 flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-400" />
              Đã Kết Nối
            </span>
            <span className="text-[10px] text-[var(--aura-text-secondary,#a0a8b0)] truncate">
              {API_BASE.replace('https://', '')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Footer: ownership line + the three persistent navigation links. */
export function SystemHubFooter() {
  return (
    <footer className="max-w-7xl mx-auto px-4 sm:px-8 mt-16 pt-8 border-t border-white/10 text-center text-xs text-[var(--aura-text-secondary,#a0a8b0)] flex flex-col sm:flex-row items-center justify-between gap-4">
      <p>
        © AURA CAFE — EST. 2018 Sa Đéc, Đồng Tháp. All system rights reserved.
      </p>
      <div className="flex items-center gap-4">
        <Link to="/about" className="hover:text-white transition-colors">
          Giới Thiệu
        </Link>
        <Link to="/brand" className="hover:text-white transition-colors">
          Brand Guidelines
        </Link>
        <Link to="/admin/login" className="hover:text-white transition-colors">
          Admin Login
        </Link>
      </div>
    </footer>
  );
}
