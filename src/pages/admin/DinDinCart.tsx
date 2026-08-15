'use client';

import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useDinDinCart } from './use-dindin-cart';
import { CartActiveView } from './cart-active-view';
import { CartListView } from './cart-list-view';

export default function DinDinCart() {
  const {
    carts, activeCart, loading, error, message, sessionInput, d02Alert, itemId, itemQty,
    setSessionInput, setItemId, setItemQty, loadOne, patchCart, t,
  } = useDinDinCart();

  if (loading && !activeCart) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-[var(--aura-text-secondary)]">{t('loading', { defaultValue: 'Đang tải...' })}</p>
      </div>
    );
  }

  return (
    <>
      <HelmetHead title={t('dindin.cartTitle', { defaultValue: 'Giỏ hàng' })} description={t('dindin.cartDesc', { defaultValue: 'Quản lý giỏ hàng khách hàng' })} />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-[var(--aura-text-primary)]">
          {t('dindin.cartTitle', { defaultValue: 'Giỏ hàng' })}
        </h1>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)' }} role="alert">
            {error}
          </div>
        )}
        {message && <p className="text-sm text-green-400">{message}</p>}
        {d02Alert && <p className="text-sm text-yellow-400">{d02Alert}</p>}

        <div className="flex gap-2">
          <input
            type="text"
            value={sessionInput}
            onChange={(e) => setSessionInput(e.target.value)}
            placeholder={t('dindin.sessionId', { defaultValue: 'Session ID' })}
            className="flex-1 rounded-xl px-3 py-2 text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]"
          />
          <button type="button" onClick={() => { if (sessionInput.trim()) loadOne(sessionInput.trim()); }} className="rounded-full px-4 py-2 text-xs font-semibold bg-[var(--aura-chrome-mid)] text-white">
            {t('load', { defaultValue: 'Tải' })}
          </button>
        </div>

        {activeCart && (
          <CartActiveView
            cart={activeCart}
            itemId={itemId}
            itemQty={itemQty}
            onItemIdChange={setItemId}
            onItemQtyChange={setItemQty}
            onPatch={patchCart}
            saving={false}
            t={t}
          />
        )}

        <CartListView carts={carts} onSelect={loadOne} t={t} />
      </div>
    </>
  );
}
