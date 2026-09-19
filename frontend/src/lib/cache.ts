/**
 * Lightweight client-side cache with stale-while-revalidate pattern.
 * Stores API responses in localStorage so the UI renders instantly on revisit
 * while fresh data loads in the background.
 */

const CACHE_VERSION = 'crm_v1';
const DEFAULT_TTL_MS = 30_000; // 30 seconds

function key(url: string) {
  return `${CACHE_VERSION}:${url}`;
}

export function cacheGet<T>(url: string): T | null {
  try {
    const raw = localStorage.getItem(key(url));
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) return null; // stale
    return data as T;
  } catch {
    return null;
  }
}

export function cacheSet<T>(url: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  try {
    localStorage.setItem(key(url), JSON.stringify({ data, expiresAt: Date.now() + ttlMs }));
  } catch {
    // localStorage full or SSR — silently ignore
  }
}

/**
 * fetchWithCache - fetches from cache first (instant), then refetches in background.
 * @param url - the endpoint URL
 * @param onData - called immediately with cached data (if any), then again when fresh data arrives
 * @param ttlMs - how long to cache the result
 */
export async function fetchWithCache<T>(
  url: string,
  onData: (data: T, isFromCache: boolean) => void,
  ttlMs = DEFAULT_TTL_MS
): Promise<void> {
  // 1. Serve cache immediately (instant render)
  const cached = cacheGet<T>(url);
  if (cached) {
    onData(cached, true);
  }

  // 2. Fetch fresh data in background
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const fresh: T = await res.json();
    cacheSet<T>(url, fresh, ttlMs);
    onData(fresh, false);
  } catch (e) {
    // If fetch fails and we had cache, keep showing it
    if (!cached) throw e;
  }
}
