/**
 * In-memory cache with TTL + request deduplication.
 * Prevents duplicate Yahoo Finance calls when multiple consumers
 * request the same data before the first fetch completes.
 */

const memCache = new Map();
const inFlight = new Map(); // tracks in-progress fetches to deduplicate

/**
 * Get a cached value if it exists and hasn't expired.
 * @param {string} key - Cache key
 * @param {number} ttlSeconds - TTL in seconds (used to check expiry)
 * @returns {any|null} Cached data or null
 */
export async function getCache(key, ttlSeconds = 300) {
  const item = memCache.get(key);
  if (item && Date.now() < item.expiry) {
    console.log(`[CACHE HIT] ${key} (expires in ${Math.round((item.expiry - Date.now()) / 1000)}s)`);
    return item.data;
  }
  return null;
}

/**
 * Store a value in cache with a TTL.
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttlSeconds - TTL in seconds
 */
export async function setCache(key, data, ttlSeconds = 300) {
  memCache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
  console.log(`[CACHE SET] ${key} (TTL: ${ttlSeconds}s)`);
}

/**
 * Wraps an async fetcher function with caching + request deduplication.
 * If the same key is already being fetched, returns the existing promise
 * instead of starting a new request.
 *
 * @param {string} key - Cache key
 * @param {Function} fetcher - Async function that returns data
 * @param {number} ttlSeconds - Cache TTL in seconds
 * @returns {Promise<any>} Cached or freshly fetched data
 */
export async function cachedFetch(key, fetcher, ttlSeconds = 300) {
  // 1. Check cache first
  const cached = await getCache(key, ttlSeconds);
  if (cached) return cached;

  // 2. Check if there's an identical request already in-flight
  if (inFlight.has(key)) {
    console.log(`[DEDUP] Reusing in-flight request for: ${key}`);
    return inFlight.get(key);
  }

  // 3. Start new fetch, store the promise for deduplication
  const fetchPromise = (async () => {
    try {
      const data = await fetcher();
      await setCache(key, data, ttlSeconds);
      return data;
    } finally {
      // Always clean up the in-flight tracker
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * Clears a specific cache entry or the entire cache.
 * @param {string} [key] - Optional specific key to clear
 */
export function clearCache(key) {
  if (key) {
    memCache.delete(key);
    console.log(`[CACHE CLEAR] ${key}`);
  } else {
    memCache.clear();
    console.log(`[CACHE CLEAR] All entries cleared`);
  }
}

/**
 * Get cache stats for debugging.
 */
export function getCacheStats() {
  const entries = [];
  for (const [key, item] of memCache) {
    entries.push({
      key,
      expired: Date.now() >= item.expiry,
      expiresIn: Math.round((item.expiry - Date.now()) / 1000),
    });
  }
  return {
    totalEntries: memCache.size,
    inFlightRequests: inFlight.size,
    entries,
  };
}
