export interface DedupMatch {
  matched: boolean;
  existingId?: string;
  matchField?: 'phone' | 'email' | 'tax_id';
}

export function findDuplicate(
  local: Record<string, unknown>,
  existing: Record<string, unknown>,
  fields: ('phone' | 'email' | 'tax_id')[] = ['phone', 'email', 'tax_id'],
): DedupMatch {
  for (const field of fields) {
    const localVal = local[field];
    const existVal = existing[field];
    if (localVal && existVal && String(localVal) === String(existVal)) {
      return {
        matched: true,
        existingId: String(existVal.id ?? ''),
        matchField: field,
      };
    }
  }
  return { matched: false };
}

export function mergeCustomerData(
  local: Record<string, unknown>,
  existing: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existing };
  for (const [key, val] of Object.entries(local)) {
    if (val !== null && val !== undefined && val !== '') {
      merged[key] = val;
    }
  }
  return merged;
}
