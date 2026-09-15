// Availability policies — pure normalization of the `available` query filter.
// D1 stores availability as INTEGER 0/1; the HTTP layer accepts truthy strings.

/**
 * `?available=true|1` → 1, `?available=false|0` → 0, absent/other → null (no filter).
 */
export function parseAvailabilityFilter(raw: string | null): 0 | 1 | null {
  if (raw === null) return null;
  return raw === 'true' || raw === '1' ? 1 : 0;
}

/** Coerce D1's 0/1 column into the API's boolean field. */
export function toAvailabilityFlag(v: unknown): boolean {
  return Boolean(v);
}
