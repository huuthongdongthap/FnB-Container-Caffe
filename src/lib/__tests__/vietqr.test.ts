import { describe, expect, it } from 'vitest';
import { buildStorefrontVietQrUrl } from '../vietqr';

describe('buildStorefrontVietQrUrl', () => {
  it('returns null when bankBin or bankAccountNo is missing or contains only symbols', () => {
    expect(
      buildStorefrontVietQrUrl({ bankBin: null, bankAccountNo: '0123456789', amountVnd: 45000, description: 'DH 101' })
    ).toBeNull();

    expect(
      buildStorefrontVietQrUrl({ bankBin: '970436', bankAccountNo: '   ', amountVnd: 45000, description: 'DH 101' })
    ).toBeNull();

    expect(
      buildStorefrontVietQrUrl({ bankBin: '---', bankAccountNo: '0123456789', amountVnd: 45000, description: 'DH 101' })
    ).toBeNull();
  });

  it('builds a valid compact2 VietQR QuickLink URL with sanitized bank fields and query params', () => {
    const url = buildStorefrontVietQrUrl({
      bankBin: '9704-36 ',
      bankAccountNo: '0123 456 789',
      bankAccountName: 'QUAN CA PHE MEKONG',
      amountVnd: 75000.4,
      description: 'DH ORD-001',
    });

    expect(url).toBeTruthy();
    const parsed = new URL(url!);
    expect(parsed.origin).toBe('https://img.vietqr.io');
    expect(parsed.pathname).toBe('/image/970436-0123456789-compact2.png');
    expect(parsed.searchParams.get('amount')).toBe('75000');
    expect(parsed.searchParams.get('addInfo')).toBe('DH ORD-001');
    expect(parsed.searchParams.get('accountName')).toBe('QUAN CA PHE MEKONG');
  });

  it('omits zero/negative/NaN amounts, clamps description to 50 chars, and omits empty query strings', () => {
    const zeroUrl = new URL(
      buildStorefrontVietQrUrl({ bankBin: '970422', bankAccountNo: '88889999', amountVnd: 0, description: 'A'.repeat(80) })!
    );
    expect(zeroUrl.searchParams.has('amount')).toBe(false);
    expect(zeroUrl.searchParams.get('addInfo')?.length).toBe(50);

    const negUrl = buildStorefrontVietQrUrl({
      bankBin: '970422',
      bankAccountNo: '88889999',
      amountVnd: -5000,
      description: '   ',
      bankAccountName: '  ',
    });
    expect(negUrl).toBe('https://img.vietqr.io/image/970422-88889999-compact2.png');

    const nanUrl = buildStorefrontVietQrUrl({ bankBin: '970422', bankAccountNo: '88889999', amountVnd: Number.NaN, description: '' });
    expect(nanUrl).toBe('https://img.vietqr.io/image/970422-88889999-compact2.png');
  });
});
