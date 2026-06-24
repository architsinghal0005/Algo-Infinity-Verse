// Verification script for Spatial Complexity Profiler

// 1. Recursive Fibonacci Generator
function* fibRecursiveGen(n) {
    let lineCounts = {};
    let stack = [];
    let peakStack = 0;
    
    function incLine(idx) {
        lineCounts[idx] = (lineCounts[idx] || 0) + 1;
    }
    
    function* fib(val) {
        const frame = { name: `fib(${val})` };
        stack.push(frame);
        if (stack.length > peakStack) peakStack = stack.length;
        
        incLine(0); // function header
        yield { lineIndex: 0, lineCounts, stack: [...stack], heap: [], peakStack };

        incLine(1); // if (val <= 1)
        yield { lineIndex: 1, lineCounts, stack: [...stack], heap: [], peakStack };
        if (val <= 1) {
            incLine(2); // return val;
            yield { lineIndex: 2, lineCounts, stack: [...stack], heap: [], peakStack };
            stack.pop();
            return val;
        }

        incLine(4); // return fib(val - 1) + fib(val - 2)
        yield { lineIndex: 4, lineCounts, stack: [...stack], heap: [], peakStack };
        
        const a = yield* fib(val - 1);
        const b = yield* fib(val - 2);
        
        stack.pop();
        return a + b;
    }
    
    yield* fib(n);
}

// 2. Iterative Fibonacci Generator
function* fibIterativeGen(n) {
    let lineCounts = {};
    let stack = [{ name: `fibIterative(${n})` }];
    let heap = [];
    let peakStack = 1;
    let peakHeap = 0;
    
    function incLine(idx) {
        lineCounts[idx] = (lineCounts[idx] || 0) + 1;
    }
    
    incLine(0); // function header
    yield { lineIndex: 0, lineCounts, stack, heap: [...heap], peakStack, peakHeap };
    
    incLine(1); // let fib = [0, 1] (or dynamic variables)
    heap.push({ name: "fibArray", val: "[0, 1]", size: 2 });
    peakHeap = 2;
    yield { lineIndex: 1, lineCounts, stack, heap: [...heap], peakStack, peakHeap };
    
    for (let i = 2; i <= n; i++) {
        incLine(2); // loop check
        yield { lineIndex: 2, lineCounts, stack, heap: [...heap], peakStack, peakHeap };
        
        incLine(3); // fib[i] = fib[i-1] + fib[i-2]
        heap[0].size = i + 1;
        if (heap[0].size > peakHeap) peakHeap = heap[0].size;
        yield { lineIndex: 3, lineCounts, stack, heap: [...heap], peakStack, peakHeap };
    }
    
    incLine(5); // return fib[n]
    yield { lineIndex: 5, lineCounts, stack, heap: [...heap], peakStack, peakHeap };
}

// 3. Merge Sort Generator
function* mergeSortGen(arr) {
    let lineCounts = {};
    let stack = [];
    let heap = [];
    let peakStack = 0;
    let peakHeap = 0;

    function incLine(idx) {
        lineCounts[idx] = (lineCounts[idx] || 0) + 1;
    }

    function* sort(subArr, name = "mergeSort") {
        stack.push({ name: `${name}(size: ${subArr.length})` });
        if (stack.length > peakStack) peakStack = stack.length;

        incLine(0); // function entry
        yield { lineIndex: 0, lineCounts, stack: [...stack], heap: [...heap], peakStack, peakHeap };

        incLine(1); // base case check
        yield { lineIndex: 1, lineCounts, stack: [...stack], heap: [...heap], peakStack, peakHeap };
        if (subArr.length <= 1) {
            stack.pop();
            return subArr;
        }

        incLine(3); // split mid
        yield { lineIndex: 3, lineCounts, stack: [...stack], heap: [...heap], peakStack, peakHeap };
        const mid = Math.floor(subArr.length / 2);

        const left = yield* sort(subArr.slice(0, mid), "leftPart");
        const right = yield* sort(subArr.slice(mid), "rightPart");

        // Merge logic (representing dynamic auxiliary heap space)
        incLine(6); // merging arrays
        const tempHeapIdx = heap.push({ name: "tempMergeArray", size: subArr.length }) - 1;
        if (subArr.length > peakHeap) peakHeap = subArr.length;
        yield { lineIndex: 6, lineCounts, stack: [...stack], heap: [...heap], peakStack, peakHeap };

        const merged = [];
        let lIdx = 0, rIdx = 0;
        while (lIdx < left.length && rIdx < right.length) {
            if (left[lIdx] < right[rIdx]) merged.push(left[lIdx++]);
            else merged.push(right[rIdx++]);
        }
        while (lIdx < left.length) merged.push(left[lIdx++]);
        while (rIdx < right.length) merged.push(right[rIdx++]);

        // Release temp heap space
        heap.splice(tempHeapIdx, 1);
        
        stack.pop();
        return merged;
    }

    yield* sort(arr);
}

// 4. Quick Sort Generator (In place)
function* quickSortGen(arr) {
    let lineCounts = {};
    let stack = [];
    let heap = [{ name: "inPlaceArray", size: arr.length }];
    let peakStack = 0;
    let peakHeap = arr.length;

    function incLine(idx) {
        lineCounts[idx] = (lineCounts[idx] || 0) + 1;
    }

    function* qsort(left, right) {
        stack.push({ name: `qsort(L: ${left}, R: ${right})` });
        if (stack.length > peakStack) peakStack = stack.length;

        incLine(0); // function header
        yield { lineIndex: 0, lineCounts, stack: [...stack], heap: [...heap], peakStack, peakHeap };

        incLine(1); // boundary check
        yield { lineIndex: 1, lineCounts, stack: [...stack], heap: [...heap], peakStack, peakHeap };
        if (left >= right) {
            stack.pop();
            return;
        }

        incLine(3); // partition call
        yield { lineIndex: 3, lineCounts, stack: [...stack], heap: [...heap], peakStack, peakHeap };
        
        // Inline partition loop tracing
        let pivot = arr[right];
        let i = left;
        for (let j = left; j < right; j++) {
            incLine(4); // partition comparison
            yield { lineIndex: 4, lineCounts, stack: [...stack], heap: [...heap], peakStack, peakHeap };
            if (arr[j] < pivot) {
                let temp = arr[i];
                arr[i] = arr[j];
                arr[j] = temp;
                i++;
            }
        }
        let temp = arr[i];
        arr[i] = arr[right];
        arr[right] = temp;

        const pivotIdx = i;

        yield* qsort(left, pivotIdx - 1);
        yield* qsort(pivotIdx + 1, right);

        stack.pop();
    }

    yield* qsort(0, arr.length - 1);
}

// Run test runner
function testRunner() {
    console.log("=== Testing Spatial Profiler Generators ===");
    
    // 1. Recursive Fib
    const fibRecGen = fibRecursiveGen(4);
    let step = fibRecGen.next();
    let maxStackRec = 0;
    while (!step.done) {
        if (step.value.stack.length > maxStackRec) maxStackRec = step.value.stack.length;
        step = fibRecGen.next();
    }
    console.log(`Recursive Fib(4) Completed. Max Stack Depth: ${maxStackRec} (Expected: 5)`);
    
    // 2. Iterative Fib
    const fibIterGen = fibIterativeGen(4);
    step = fibIterGen.next();
    let maxStackIter = 0;
    let maxHeapIter = 0;
    while (!step.done) {
        if (step.value.stack.length > maxStackIter) maxStackIter = step.value.stack.length;
        if (step.value.peakHeap > maxHeapIter) maxHeapIter = step.value.peakHeap;
        step = fibIterGen.next();
    }
    console.log(`Iterative Fib(4) Completed. Max Stack: ${maxStackIter} (Expected: 1), Peak Heap Array Size: ${maxHeapIter} (Expected: 5)`);

    // 3. Merge Sort
    const msortGen = mergeSortGen([3, 1, 2]);
    step = msortGen.next();
    let maxStackMsort = 0;
    let maxHeapMsort = 0;
    while (!step.done) {
        if (step.value.stack.length > maxStackMsort) maxStackMsort = step.value.stack.length;
        if (step.value.peakHeap > maxHeapMsort) maxHeapMsort = step.value.peakHeap;
        step = msortGen.next();
    }
    console.log(`Merge Sort Completed. Max Stack: ${maxStackMsort} (Expected: 3), Peak Auxiliary Space: ${maxHeapMsort} (Expected: 3)`);

    // 4. Quick Sort
    const qsortGen = quickSortGen([3, 1, 2]);
    step = qsortGen.next();
    let maxStackQsort = 0;
    let maxHeapQsort = 0;
    while (!step.done) {
        if (step.value.stack.length > maxStackQsort) maxStackQsort = step.value.stack.length;
        if (step.value.peakHeap > maxHeapQsort) maxHeapQsort = step.value.peakHeap;
        step = qsortGen.next();
    }
    console.log(`Quick Sort Completed. Max Stack: ${maxStackQsort} (Expected: 3), Peak Auxiliary Space: ${maxHeapQsort} (Expected: 3, representing original array, auxiliary space is 0)`);
}

testRunner();
