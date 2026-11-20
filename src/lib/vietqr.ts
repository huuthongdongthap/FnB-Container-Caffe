export interface StorefrontVietQrParams {
  bankBin?: string | null;
  bankAccountNo?: string | null;
  bankAccountName?: string | null;
  amountVnd: number;
  description: string;
}

/**
 * Builds an official VietQR QuickLink image URL for direct merchant bank transfers.
 * Returns null if bank BIN or account number is missing or invalid.
 */
export function buildStorefrontVietQrUrl(params: StorefrontVietQrParams): string | null {
  const bank = String(params.bankBin || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  const account = String(params.bankAccountNo || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  if (!bank || !account) return null;

  const amount = Math.max(0, Math.round(Number(params.amountVnd) || 0));
  const addInfo = String(params.description || '')
    .trim()
    .slice(0, 50);
  const accountName = String(params.bankAccountName || '').trim();

  const query = new URLSearchParams();
  if (amount > 0) query.set('amount', String(amount));
  if (addInfo) query.set('addInfo', addInfo);
  if (accountName) query.set('accountName', accountName);

  const qs = query.toString();
  return `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(account)}-compact2.png${qs ? `?${qs}` : ''}`;
}
