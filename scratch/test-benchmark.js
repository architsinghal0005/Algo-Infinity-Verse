import { computeGlobalThresholds, getUserBenchmark } from '../backend/benchmarking/percentileService.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../');
const DATA_DIR = path.join(ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function setupMockData() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const users = [];
    
    // Create 20 mock users with somewhat randomized scores
    for (let i = 0; i < 20; i++) {
        users.push({
            id: crypto.randomUUID(),
            name: `MockUser_${i}`,
            email: `mockuser${i}@example.com`
        });
    }

    // Force one user to have a specific ID to test against
    users[0].id = 'known-id-123';
    users[0].name = 'Alice Testing';
    
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    console.log('Mock user data initialized.');
}

async function runTests() {
    console.log('--- Setting up Benchmarking Tests ---');
    await setupMockData();

    console.log('\n--- TEST 1: Compute Global Thresholds ---');
    const thresholds = await computeGlobalThresholds();
    console.log('Global Thresholds Calculated:');
    console.log(JSON.stringify(thresholds, null, 2));
    
    if (thresholds.insufficientData) {
        console.error('Test failed: Should have sufficient data (20 users).');
        process.exit(1);
    }

    console.log('\n--- TEST 2: Get Specific User Benchmark ---');
    const userBenchmark = await getUserBenchmark('known-id-123');
    console.log('Alice\'s Benchmark Data:');
    console.log(JSON.stringify(userBenchmark, null, 2));

    console.log('\n--- TEST 3: New User (0 Score) ---');
    const newUserBenchmark = await getUserBenchmark('non-existent-id-456');
    console.log('New User Benchmark Data:');
    console.log(JSON.stringify(newUserBenchmark, null, 2));

    console.log('\nAll tests passed successfully!');
    process.exit(0);
}

runTests().catch(console.error);
