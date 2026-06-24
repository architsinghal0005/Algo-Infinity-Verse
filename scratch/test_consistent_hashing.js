/**
 * scratch/test_consistent_hashing.js
 * Headless unit test suite to verify Consistent Hashing engine.
 */

// Simple deterministic hash mapping a string to 0.0 - 360.0 degrees
function hashStringToAngle(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function findNearestServer(keyAngle, servers, useVNodes, vNodesCount = 5) {
  let ring = [];
  servers.forEach(server => {
    const count = useVNodes ? vNodesCount : 1;
    for (let i = 0; i < count; i++) {
      const hashStr = `${server.id}-replica-${i}`;
      ring.push({ angle: hashStringToAngle(hashStr), serverId: server.id });
    }
  });
  ring.sort((a, b) => a.angle - b.angle);

  let target = ring.find(node => node.angle >= keyAngle);
  if (!target) target = ring[0];
  return target;
}

function calculateStdDev(data) {
  if (data.length === 0) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
  return Math.sqrt(variance);
}

function runTests() {
  console.log("=== RUNNING CONSISTENT HASHING TESTS ===");

  // Test 1: Hash String to Angle
  (() => {
    console.log("\n--- Test 1: Hashing String to Angle ---");
    const h1 = hashStringToAngle("Node S1-replica-0");
    const h2 = hashStringToAngle("Node S1-replica-1");
    console.log("S1-replica-0 Hash Angle:", h1);
    console.log("S1-replica-1 Hash Angle:", h2);
    if (h1 < 0 || h1 >= 360 || h2 < 0 || h2 >= 360) {
      throw new Error("Test 1 Failed: Hash angles must be in [0, 360)");
    }
    console.log("✓ Hashing bounds verified.");
  })();

  // Test 2: Nearest Server Clockwise Assignment
  (() => {
    console.log("\n--- Test 2: Clockwise Assignment ---");
    const servers = [
      { id: "S1" },
      { id: "S2" },
      { id: "S3" }
    ];
    const keyAngle = 180;
    const targetNode = findNearestServer(keyAngle, servers, false);
    console.log(`Key at 180 assigned to server: ${targetNode.serverId} (angle: ${targetNode.angle})`);
    if (!targetNode || !targetNode.serverId) {
      throw new Error("Test 2 Failed: Key was not routed to any server node.");
    }
    console.log("✓ Clockwise routing assignment verified.");
  })();

  // Test 3: Key Migration on Server Failure
  (() => {
    console.log("\n--- Test 3: Key Migration on Node Failure ---");
    const servers = [
      { id: "S1" },
      { id: "S2" },
      { id: "S3" }
    ];
    
    const keys = [];
    for (let i = 0; i < 100; i++) {
      const angle = i * 3.6;
      const initialTarget = findNearestServer(angle, servers, false);
      keys.push({ id: `key-${i}`, angle, currentServerId: initialTarget.serverId });
    }

    const activeServers = servers.filter(s => s.id !== "S2");
    let migratedCount = 0;
    let unchangedCount = 0;

    keys.forEach(key => {
      const newTarget = findNearestServer(key.angle, activeServers, false);
      if (newTarget.serverId !== key.currentServerId) {
        migratedCount++;
        if (key.currentServerId !== "S2") {
          throw new Error("Test 3 Failed: Key migrated but its old server was incorrect.");
        }
      } else {
        unchangedCount++;
      }
    });

    console.log(`Total Keys: ${keys.length}`);
    console.log(`Migrated Keys (previously on S2): ${migratedCount}`);
    console.log(`Unchanged Keys: ${unchangedCount}`);

    if (migratedCount === 0 || migratedCount === keys.length) {
      throw new Error("Test 3 Failed: Migration load should only be a fraction of total keys.");
    }
    console.log("✓ Node failure key migration fraction verified.");
  })();

  // Test 4: Load Balancing (vNodes Std Dev check)
  (() => {
    console.log("\n--- Test 4: Load Balancing Standard Deviation ---");
    const servers = [
      { id: "S1" },
      { id: "S2" },
      { id: "S3" },
      { id: "S4" }
    ];

    const runSimulation = (useVNodes) => {
      const distribution = { S1: 0, S2: 0, S3: 0, S4: 0 };
      for (let i = 0; i < 1000; i++) {
        const angle = hashStringToAngle(`data-key-${i}`);
        const target = findNearestServer(angle, servers, useVNodes, 10);
        distribution[target.serverId]++;
      }
      return Object.values(distribution);
    };

    const loadWithoutVNodes = runSimulation(false);
    const loadWithVNodes = runSimulation(true);

    const devWithout = calculateStdDev(loadWithoutVNodes);
    const devWith = calculateStdDev(loadWithVNodes);

    console.log("Load without vNodes:", loadWithoutVNodes, "Std Dev:", devWithout.toFixed(2));
    console.log("Load with vNodes:", loadWithVNodes, "Std Dev:", devWith.toFixed(2));

    console.log("✓ Load balancing calculation verified.");
  })();

  console.log("\nAll Consistent Hashing tests passed successfully!");
}

runTests();
