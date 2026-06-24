/**
 * scratch/test_bloom_filter.js
 * Headless unit test suite to verify Bloom Filter hashing, insertion,
 * query, and false positive probability calculation.
 */

// Simple seeded FNV-1a hash variation
function fnv1a(str, seed = 0) {
  let hash = 0x811c9dc5 ^ seed;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // Multiply by FNV prime 16777619
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

// Generate k hash indices in [0, m - 1]
function getHashIndices(item, k, m) {
  const indices = [];
  for (let i = 0; i < k; i++) {
    // Generate independent hash values using FNV-1a with seeded primes
    const val = fnv1a(item, i * 0x01000193);
    indices.push(val % m);
  }
  return indices;
}

// Calculate theoretical false positive rate
function getTheoreticalFPR(m, k, n) {
  if (n === 0) return 0;
  const p = Math.pow(1 - Math.exp(-k * n / m), k);
  return p;
}

function runTests() {
  console.log("=== RUNNING BLOOM FILTER TESTS ===");

  // Test 1: Hash Index Distribution
  (() => {
    console.log("\n--- Test 1: Hash Indices Distribution ---");
    const m = 32;
    const k = 3;
    const item = "hello";
    const indices = getHashIndices(item, k, m);
    console.log(`Indices for "${item}" (m=${m}, k=${k}):`, indices);
    
    if (indices.length !== k) {
      throw new Error("Test 1 Failed: Should produce exactly k indices.");
    }
    
    indices.forEach(idx => {
      if (idx < 0 || idx >= m) {
        throw new Error(`Test 1 Failed: Index ${idx} is out of bounds [0, ${m - 1}]`);
      }
    });
    console.log("✓ Hash indices bounds verified.");
  })();

  // Test 2: Bloom Filter Insertion and Query
  (() => {
    console.log("\n--- Test 2: Insertion and Query ---");
    const m = 32;
    const k = 3;
    const bitArray = new Array(m).fill(0);
    
    // Insert "apple"
    const indices = getHashIndices("apple", k, m);
    indices.forEach(idx => bitArray[idx] = 1);
    
    // Verify bits are set
    console.log("Bit Array state after inserting 'apple':", bitArray.join(''));
    indices.forEach(idx => {
      if (bitArray[idx] !== 1) {
        throw new Error(`Test 2 Failed: Bit at index ${idx} was not set.`);
      }
    });

    // Query "apple" (should be present)
    const queryAppleIndices = getHashIndices("apple", k, m);
    const applePresent = queryAppleIndices.every(idx => bitArray[idx] === 1);
    console.log("Query 'apple' present:", applePresent);
    if (!applePresent) {
      throw new Error("Test 2 Failed: Inserted item 'apple' queried as absent.");
    }

    // Query "banana" (should most likely be absent)
    const queryBananaIndices = getHashIndices("banana", k, m);
    const bananaPresent = queryBananaIndices.every(idx => bitArray[idx] === 1);
    console.log("Query 'banana' present (potential false positive):", bananaPresent);
    console.log("✓ Insertion and Query state matching verified.");
  })();

  // Test 3: Theoretical False Positive Probability Formula
  (() => {
    console.log("\n--- Test 3: Theoretical FPR Formula ---");
    const m = 64;
    const k = 4;
    const n = 10;
    const fpr = getTheoreticalFPR(m, k, n);
    console.log(`Theoretical FPR (m=${m}, k=${k}, n=${n}):`, (fpr * 100).toFixed(2) + "%");
    
    // Math checks: p = (1 - e^(-40/64))^4 = (1 - e^-0.625)^4 = (1 - 0.535)^4 = 0.465^4 = ~0.046 (4.6%)
    if (fpr < 0.04 || fpr > 0.05) {
      throw new Error(`Test 3 Failed: Expected FPR near 4.6%, got ${(fpr * 100).toFixed(2)}%`);
    }
    console.log("✓ Theoretical FPR formula correctness verified.");
  })();

  // Test 4: False Positive Simulation
  (() => {
    console.log("\n--- Test 4: Empirical False Positive Simulation ---");
    const m = 64;
    const k = 4;
    const bitArray = new Array(m).fill(0);
    
    // Insert 10 items
    for (let i = 0; i < 10; i++) {
      const indices = getHashIndices(`inserted-item-${i}`, k, m);
      indices.forEach(idx => bitArray[idx] = 1);
    }

    // Query 1000 absent items
    let falsePositives = 0;
    const queriesCount = 1000;
    for (let i = 0; i < queriesCount; i++) {
      const indices = getHashIndices(`absent-item-${i}`, k, m);
      const present = indices.every(idx => bitArray[idx] === 1);
      if (present) {
        falsePositives++;
      }
    }

    const empiricalFPR = falsePositives / queriesCount;
    const theoreticalFPR = getTheoreticalFPR(m, k, 10);
    console.log(`Empirical FPR: ${(empiricalFPR * 100).toFixed(2)}% (${falsePositives}/${queriesCount})`);
    console.log(`Theoretical FPR: ${(theoreticalFPR * 100).toFixed(2)}%`);
    
    // Validate they are reasonably close (within variance margin)
    const diff = Math.abs(empiricalFPR - theoreticalFPR);
    console.log("Absolute difference between Empirical and Theoretical:", diff.toFixed(4));
    if (diff > 0.05) {
      throw new Error("Test 4 Failed: Empirical FPR deviates significantly from Theoretical FPR.");
    }
    console.log("✓ Empirical simulation matches theoretical bounds.");
  })();

  console.log("\nAll Bloom Filter tests passed successfully!");
}

runTests();
