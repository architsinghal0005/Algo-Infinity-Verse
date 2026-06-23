/**
 * Vanilla JS Stale-While-Revalidate (SWR) Caching Engine
 */

const cache = new Map();
const activePromises = new Map();

const DEFAULT_OPTIONS = {
    ttl: 5 * 60 * 1000, // 5 minutes
    onRevalidate: null  // Callback triggered when background fetch completes with new data
};

/**
 * Main SWR fetch mechanism
 * @param {string} key - Unique identifier for the request
 * @param {Function} fetcher - Function returning a Promise that fetches the data
 * @param {Object} options - Configuration options
 * @returns {Promise<{ data: any, isStale: boolean }>}
 */
export async function fetchWithCache(key, fetcher, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const now = Date.now();
    
    // 1. Check Cache (Stale Phase)
    const cachedRecord = cache.get(key);
    const isFresh = cachedRecord && (now - cachedRecord.timestamp < opts.ttl);

    // If fresh, just return it without revalidating
    if (isFresh) {
        return { data: cachedRecord.data, isStale: false };
    }

    // 2. Revalidate Phase
    // If a request for this key is already in flight, reuse that promise (Deduplication)
    if (!activePromises.has(key)) {
        const fetchPromise = fetcher()
            .then(data => {
                const isDifferent = !cachedRecord || JSON.stringify(cachedRecord.data) !== JSON.stringify(data);
                
                // Update cache
                cache.set(key, { data, timestamp: Date.now() });
                
                // Trigger callback if data changed
                if (cachedRecord && isDifferent && typeof opts.onRevalidate === 'function') {
                    opts.onRevalidate(data);
                }
                
                return data;
            })
            .finally(() => {
                activePromises.delete(key);
            });

        activePromises.set(key, fetchPromise);
    }

    // If we had stale data, return it immediately while the activePromise runs in background
    if (cachedRecord) {
        // Run background update silently
        activePromises.get(key).catch(err => console.error(`[SWR] Background revalidation failed for ${key}:`, err));
        return { data: cachedRecord.data, isStale: true };
    }

    // No stale data available, must wait for network
    const newData = await activePromises.get(key);
    return { data: newData, isStale: false };
}

/**
 * Force invalidate a cache key
 */
export function mutate(key) {
    cache.delete(key);
}

/**
 * Clear the entire cache
 */
export function clearCache() {
    cache.clear();
}
