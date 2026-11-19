export interface UtmAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  landing_path?: string;
  captured_at?: string;
}

export const UTM_STORAGE_KEY = 'aura_utm_attribution';

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

type UtmParamKey = (typeof UTM_KEYS)[number];

const MAX_UTM_VALUE_LENGTH = 120;

function sanitizeUtmValue(raw: string | null | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_UTM_VALUE_LENGTH);
}

function getSafeSessionStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function parseUtmFromSearch(search: string): UtmAttribution {
  const result: UtmAttribution = {};
  if (!search) return result;

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of UTM_KEYS) {
    const clean = sanitizeUtmValue(params.get(key));
    if (clean) {
      result[key] = clean;
    }
  }
  return result;
}

function hasAnyUtmKey(utm: Partial<UtmAttribution> | null | undefined): boolean {
  if (!utm) return false;
  return UTM_KEYS.some((key) => Boolean(sanitizeUtmValue(utm[key])));
}

export function getStoredUtm(): UtmAttribution | null {
  const storage = getSafeSessionStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(UTM_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const normalized: UtmAttribution = {};
    for (const key of UTM_KEYS) {
      const value = record[key];
      if (typeof value === 'string') {
        const clean = sanitizeUtmValue(value);
        if (clean) normalized[key] = clean;
      }
    }

    if (!hasAnyUtmKey(normalized)) return null;

    if (typeof record.landing_path === 'string' && record.landing_path.trim()) {
      normalized.landing_path = record.landing_path.trim().slice(0, 200);
    }
    if (typeof record.captured_at === 'string' && record.captured_at.trim()) {
      normalized.captured_at = record.captured_at.trim().slice(0, 64);
    }
    return normalized;
  } catch {
    return null;
  }
}

export function clearStoredUtm(): void {
  const storage = getSafeSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(UTM_STORAGE_KEY);
  } catch {
    // Ignore storage quota/security errors in restricted browser contexts
  }
}

export function captureUtmFromSearch(search?: string, pathname?: string): UtmAttribution | null {
  const resolvedSearch =
    search !== undefined ? search : typeof window !== 'undefined' ? window.location.search : '';
  const resolvedPathname =
    pathname !== undefined ? pathname : typeof window !== 'undefined' ? window.location.pathname : undefined;

  const parsed = parseUtmFromSearch(resolvedSearch);
  if (hasAnyUtmKey(parsed)) {
    const existing = getStoredUtm();
    const isSameCampaign =
      existing !== null &&
      UTM_KEYS.every((key) => existing[key] === parsed[key]);

    const attribution: UtmAttribution = {
      ...parsed,
      ...(isSameCampaign && existing.landing_path
        ? { landing_path: existing.landing_path }
        : resolvedPathname
          ? { landing_path: resolvedPathname.slice(0, 200) }
          : {}),
      captured_at:
        isSameCampaign && existing.captured_at
          ? existing.captured_at
          : new Date().toISOString(),
    };

    const storage = getSafeSessionStorage();
    if (storage) {
      try {
        storage.setItem(UTM_STORAGE_KEY, JSON.stringify(attribution));
      } catch {
        // Ignore storage write errors in private mode / quota exceeded
      }
    }
    return attribution;
  }

  return getStoredUtm();
}

export function buildUrlWithUtm(basePath: string, utm?: Partial<UtmAttribution> | null): string {
  if (!utm || !hasAnyUtmKey(utm)) return basePath;

  const hashIndex = basePath.indexOf('#');
  const withoutHash = hashIndex >= 0 ? basePath.slice(0, hashIndex) : basePath;
  const hash = hashIndex >= 0 ? basePath.slice(hashIndex) : '';

  const queryIndex = withoutHash.indexOf('?');
  const pathPart = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const existingQuery = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '';

  const params = new URLSearchParams(existingQuery);
  for (const key of UTM_KEYS as readonly UtmParamKey[]) {
    const clean = sanitizeUtmValue(utm[key]);
    if (clean && !params.has(key)) {
      params.set(key, clean);
    }
  }

  const queryString = params.toString();
  return `${pathPart}${queryString ? `?${queryString}` : ''}${hash}`;
}
