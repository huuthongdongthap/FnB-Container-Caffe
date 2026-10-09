/**
 * Canonical Sensitive Data Redaction Policy
 * Ensures credentials, tokens, and payment secrets never enter audit logs.
 */

const SENSITIVE_KEY_PATTERN = /password|passwd|token|secret|api_key|apikey|access_token|refresh_token|auth_token|authorization|bearer|cookie|credential|pin|cvv|cvc|card_number|pan|private_key/i;
const JWT_PATTERN = /^ey[A-Za-z0-9-_]+\.ey[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
const CARD_NUMBER_PATTERN = /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$/;

export function redactSensitiveValue(val: unknown): unknown {
  if (typeof val === 'string') {
    if (JWT_PATTERN.test(val)) return '[JWT_REDACTED]';
    const cleanNum = val.replace(/[\s-]/g, '');
    if (CARD_NUMBER_PATTERN.test(cleanNum)) {
      return `**** **** **** ${cleanNum.slice(-4)}`;
    }
  }
  return val;
}

export function redactSensitiveData(data: unknown, seen = new WeakSet()): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return redactSensitiveValue(data);

  if (seen.has(data as object)) return '[CIRCULAR]';
  seen.add(data as object);

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactSensitiveData(value, seen);
    }
  }
  return result;
}
