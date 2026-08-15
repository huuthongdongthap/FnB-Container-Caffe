const TABLE_SLUG_RE = /^[a-zA-Z0-9_-]+$/;

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isTableIdValid(raw: string | null): raw is string {
  return Boolean(raw && TABLE_SLUG_RE.test(raw.trim()));
}

export function validateCustomerForm(
  guestName: string,
  guestPhone: string,
  t: (key: string, opts?: Record<string, string>) => string,
): { valid: boolean; error?: string } {
  if (!guestName.trim()) {
    return {
      valid: false,
      error: t('missingName', { defaultValue: 'Vui lòng nhập tên của bạn' }),
    };
  }
  const digits = normalizePhone(guestPhone);
  if (digits.length < 8) {
    return {
      valid: false,
      error: t('invalidPhone', {
        defaultValue: 'Vui lòng nhập số điện thoại hợp lệ (ít nhất 8 chữ số)',
      }),
    };
  }
  return { valid: true };
}
