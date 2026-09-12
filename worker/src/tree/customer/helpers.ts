/**
 * Customer domain — shared helpers.
 *
 * Zero-based policy: every write is an AURA-verified capture. IDs are
 * generated locally (no external sequence), timestamps ISO (UTC) to
 * match orders.created_at convention.
 */

export function genCustomerId(prefix = 'cus_'): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return prefix + Date.now().toString(36) + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/** Normalize a VN phone to bare digits (keeps leading 0 / 84). */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw).replace(/\D/g, '');
}

/** True when a digit string is a plausible VN mobile/landline length. */
export function isPlausibleVnPhone(digits: string): boolean {
  return digits.length >= 9 && digits.length <= 12;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export type IdentifierType = 'phone' | 'email' | 'zalo' | 'other';

/** Pick the identifier type from a raw value; '' when none applies. */
export function classifyIdentifier(
  phone: string | null | undefined,
  email: string | null | undefined,
  zalo: string | null | undefined
): { type: IdentifierType; value: string } | null {
  const digits = normalizePhone(phone);
  if (isPlausibleVnPhone(digits)) return { type: 'phone', value: digits };
  if (email && /.+@.+\..+/.test(email) && !email.endsWith('@loyalty.aura')) {
    return { type: 'email', value: email.toLowerCase() };
  }
  if (zalo) return { type: 'zalo', value: String(zalo).replace(/\s+/g, '') };
  return null;
}
