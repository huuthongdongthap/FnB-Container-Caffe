'use client';

import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ChefHat,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
} from 'lucide-react';

/** Sticky top bar: brand block + the four operations shortcuts. */
export function SystemHubTopBar() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-[var(--aura-chrome-dim,rgba(201,214,223,0.15))] bg-[#0A1A2E]/80 px-4 sm:px-8 py-4 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/images/aura-emblem.png"
              alt="AURA CAFE"
              className="h-10 w-10 rounded-xl border border-[#6B9FB8]/40 object-contain p-0.5 drop-shadow-[0_0_12px_rgba(107,159,184,0.3)] transition-transform group-hover:scale-105"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/images/aura-master-logo.png';
              }}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xl font-bold tracking-tight text-[var(--aura-chrome-bright,#E8EEF3)]">
                  AURA CAFE
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {typeof window !== 'undefined' && window.location?.host
                    ? window.location.host
                    : 'auraspace.cafe'}
                </span>
              </div>
              <p className="text-xs text-[var(--aura-text-secondary,#a0a8b0)]">
                Trạm Điều Hành & Danh Mục Phân Hệ Toàn Diện
              </p>
            </div>
          </Link>
        </div>

        {/* Quick action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/kds"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-all shadow-sm"
          >
            <ChefHat size={14} />
            <span>KDS Bếp</span>
          </Link>
          <Link
            to="/admin/pos"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-xs font-medium hover:bg-cyan-500/20 transition-all shadow-sm"
          >
            <CreditCard size={14} />
            <span>POS Thu Ngân</span>
          </Link>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition-all shadow-sm"
          >
            <LayoutDashboard size={14} />
            <span>Cổng Admin</span>
          </Link>
          <Link
            to="/admin/table-management"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 text-xs font-medium hover:bg-indigo-500/20 transition-all shadow-sm"
          >
            <LayoutGrid size={14} />
            <span>Sơ Đồ Bàn</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-white/80 text-xs font-medium hover:bg-white/10 transition-all"
          >
            <span>Về Trang Khách</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}
