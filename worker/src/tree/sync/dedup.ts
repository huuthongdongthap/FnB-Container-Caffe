export interface DedupMatch {
  matched: boolean;
  existingId?: string;
  matchField?: 'phone' | 'email' | 'tax_id';
}

export function findDuplicate(
  local: Record<string, unknown>,
  existing: Record<string, unknown>,
  fields: ('phone' | 'email' | 'tax_id')[] = ['phone', 'email', 'tax_id']
): DedupMatch {
  for (const field of fields) {
    const localVal = local[field];
    const existVal = existing[field];
    if (localVal && existVal && String(localVal) === String(existVal)) {
      return {
        matched: true,
        existingId: String((existing as { id?: string | number }).id ?? ''),
        matchField: field
      };
    }
  }
  return { matched: false };
}

export function mergeCustomerData(
  local: Record<string, unknown>,
  existing: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existing };
  for (const [key, val] of Object.entries(local)) {
    if (val !== null && val !== undefined && val !== '') {
      merged[key] = val;
    }
  }
  return merged;
}

export function calculateMatchScore(
  local: Record<string, unknown>,
  existing: Record<string, unknown>
): number {
  const weights = { phone: 0.4, email: 0.35, tax_id: 0.25 };
  let score = 0;
  for (const field of Object.keys(weights) as ('phone' | 'email' | 'tax_id')[]) {
    if (local[field] && existing[field] && String(local[field]) === String(existing[field])) {
      score += weights[field];
    }
  }
  return Math.min(score, 1);
}
