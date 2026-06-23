import { fetchWithCache } from '../modules/cacheEngine.js';

let networkCalls = 0;

async function mockApiFetch() {
    networkCalls++;
    console.log(`[Network] Mock API call #${networkCalls} initiated...`);
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({ profileId: 123, name: 'Alice', timestamp: Date.now() });
        }, 500);
    });
}

async function runTests() {
    console.log('--- TEST 1: Request Deduplication ---');
    // Fire 3 requests simultaneously
    const p1 = fetchWithCache('/api/profile/123', mockApiFetch);
    const p2 = fetchWithCache('/api/profile/123', mockApiFetch);
    const p3 = fetchWithCache('/api/profile/123', mockApiFetch);
    
    await Promise.all([p1, p2, p3]);
    console.log(`Expected 1 network call. Actual: ${networkCalls}\n`);

    console.log('--- TEST 2: Stale-While-Revalidate (Instant Return) ---');
    // Simulate TTL expiration for the sake of the SWR background trigger
    // By forcing a custom fetch with a very low TTL, we ensure it's "stale" but we still have data
    const start = Date.now();
    const result = await fetchWithCache('/api/profile/123', mockApiFetch, {
        ttl: -1, // Force it to be stale immediately so background revalidation fires
        onRevalidate: (newData) => {
            console.log('[UI Callback] Revalidation finished in background, UI silently updated with new data.');
        }
    });
    const elapsed = Date.now() - start;
    
    console.log(`Cache returned in ${elapsed}ms! isStale: ${result.isStale}`);
    console.log('Wait a moment for background revalidation to finish...\n');
    
    await new Promise(resolve => setTimeout(resolve, 600));
    console.log(`Expected 2 network calls total. Actual: ${networkCalls}`);
    process.exit(0);
}

runTests();
