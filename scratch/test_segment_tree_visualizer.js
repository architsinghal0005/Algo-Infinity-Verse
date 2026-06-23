/**
 * scratch/test_segment_tree_visualizer.js
 * Headless unit test suite to verify Segment Tree construction,
 * Range Query step generation, and Point Update propagation steps.
 */

// ==========================================
// 1. SEGMENT TREE ENGINE LOGIC (DUPLICATED FOR HEADLESS TESTING)
// ==========================================
function stBuild(arr) {
  var n = arr.length;
  var tree = new Array(4 * n).fill(0);
  function buildNode(node, start, end) {
    if (start === end) { tree[node] = arr[start]; return; }
    var mid = Math.floor((start + end) / 2);
    buildNode(2 * node, start, mid);
    buildNode(2 * node + 1, mid + 1, end);
    tree[node] = tree[2 * node] + tree[2 * node + 1];
  }
  buildNode(1, 0, n - 1);
  return tree;
}

function stGenQuerySteps(tree, n, l, r) {
  var steps = [];
  function query(node, start, end, l, r) {
    if (r < start || end < l) {
      steps.push({ type: 'visit', node: node, color: 'NONE' });
      return 0;
    }
    if (l <= start && end <= r) {
      steps.push({ type: 'visit', node: node, color: 'MATCH' });
      return tree[node];
    }
    steps.push({ type: 'visit', node: node, color: 'PARTIAL' });
    var mid = Math.floor((start + end) / 2);
    var left  = query(2 * node, start, mid, l, r);
    var right = query(2 * node + 1, mid + 1, end, l, r);
    steps.push({ type: 'return', node: node, color: 'ACTIVE' });
    return left + right;
  }
  query(1, 0, n - 1, l, r);
  return steps;
}

function stGenUpdateSteps(tree, n, idx, val, oldVal) {
  var steps = [];
  var delta = val - oldVal;
  function update(node, start, end, idx, val) {
    if (start === end) {
      tree[node] += delta;
      steps.push({ type: 'update', node: node, color: 'UPDATED', idx: idx });
      return;
    }
    var mid = Math.floor((start + end) / 2);
    steps.push({ type: 'visit', node: node, color: 'ACTIVE', idx: idx });
    if (idx <= mid) update(2 * node, start, mid, idx, val);
    else update(2 * node + 1, mid + 1, end, idx, val);
    tree[node] = tree[2 * node] + tree[2 * node + 1];
    steps.push({ type: 'propagate', node: node, color: 'UPDATED', idx: idx });
  }
  update(1, 0, n - 1, idx, val);
  return steps;
}

// ==========================================
// TEST SUITE
// ==========================================
function runTests() {
  console.log("=== RUNNING SEGMENT TREE TESTS ===");

  // Test 1: Segment Tree Build Correctness
  (() => {
    console.log("\n--- Test 1: Segment Tree Build ---");
    const arr = [1, 3, 5, 7, 9, 11];
    const tree = stBuild(arr);
    
    // Sum of all elements = 36. Root node (index 1) should store 36.
    console.log("Root element value:", tree[1]);
    console.log("Leaf element at index 0 (stored at node 8?):", tree[8]); // standard binary layout
    
    if (tree[1] !== 36) {
      throw new Error(`Test 1 Failed: Expected root sum 36, got ${tree[1]}`);
    }
    console.log("✓ Segment Tree build sum verified.");
  })();

  // Test 2: Range Query Step Gen & Coloring
  (() => {
    console.log("\n--- Test 2: Range Query Step Coloring ---");
    const arr = [1, 3, 5, 7, 9, 11];
    const tree = stBuild(arr);
    
    // Query range [1..4] => values [3, 5, 7, 9] => sum 24
    const steps = stGenQuerySteps(tree, arr.length, 1, 4);
    
    console.log("Steps count for query range [1..4]:", steps.length);
    const matchSteps = steps.filter(s => s.color === 'MATCH');
    const partialSteps = steps.filter(s => s.color === 'PARTIAL');
    const noneSteps = steps.filter(s => s.color === 'NONE');

    console.log("Fully Inside nodes count (MATCH):", matchSteps.length);
    console.log("Partially Inside nodes count (PARTIAL):", partialSteps.length);
    console.log("Disjoint nodes count (NONE):", noneSteps.length);

    if (matchSteps.length === 0 || partialSteps.length === 0) {
      throw new Error("Test 2 Failed: Query step color mappings are incorrect.");
    }
    console.log("✓ Range Query step color categorization verified.");
  })();

  // Test 3: Point Update Propagation Path
  (() => {
    console.log("\n--- Test 3: Point Update Propagation Path ---");
    const arr = [1, 3, 5, 7, 9, 11];
    const tree = stBuild(arr);
    const oldVal = arr[2]; // 5
    const newVal = 10;
    
    // Update index 2 to value 10
    const steps = stGenUpdateSteps(tree, arr.length, 2, newVal, oldVal);
    
    console.log("Steps count for point update:", steps.length);
    const updateSteps = steps.filter(s => s.type === 'update');
    const propagateSteps = steps.filter(s => s.type === 'propagate');

    console.log("Leaf updates count:", updateSteps.length);
    console.log("Parent propagation recalculations count:", propagateSteps.length);

    // There should be exactly 1 leaf update, and the rest propagate up
    if (updateSteps.length !== 1 || propagateSteps.length === 0) {
      throw new Error("Test 3 Failed: Update steps did not resolve paths correctly.");
    }
    console.log("✓ Point Update propagation steps verified.");
  })();

  console.log("\nAll Segment Tree tests passed successfully!");
}

runTests();
