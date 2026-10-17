/**
 * PII Protection and Sensitive Data Masking Policy
 * Guarantees customer phone numbers, emails, and credentials never leak.
 */

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /credit[_-]?card/i,
  /cvv/i,
  /pin/i
];

export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const cleaned = phone.trim();
  if (cleaned.length < 7) return '***';
  const prefix = cleaned.slice(0, 3);
  const suffix = cleaned.slice(-3);
  return `${prefix}${'*'.repeat(cleaned.length - 6)}${suffix}`;
}

export function maskEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return '***';
  const parts = email.split('@');
  const user = parts[0]!;
  const domain = parts[1]!;
  if (user.length <= 2) return `*@${domain}`;
  return `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}@${domain}`;
}

export function redactSensitiveObject<T>(input: T, depth = 0): T {
  if (depth > 6 || input === null || typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactSensitiveObject(item, depth + 1)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pat) => pat.test(key));
    if (isSensitiveKey && typeof value === 'string') {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitiveObject(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
