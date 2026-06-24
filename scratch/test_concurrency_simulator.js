/**
 * scratch/test_concurrency_simulator.js
 * Headless test script to verify simulation state machine,
 * race conditions, scheduling, and deadlock cycle detection.
 */

class ConcurrencyEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.tasksQueue = [];
        this.threads = [
            { id: 1, state: 'idle', currentTask: null, waitingOnResource: null },
            { id: 2, state: 'idle', currentTask: null, waitingOnResource: null },
            { id: 3, state: 'idle', currentTask: null, waitingOnResource: null },
            { id: 4, state: 'idle', currentTask: null, waitingOnResource: null }
        ];
        this.resources = {
            'A': { id: 'A', lockedBy: null, value: 1000, waitingQueue: [] },
            'B': { id: 'B', lockedBy: null, value: 1000, waitingQueue: [] },
            'C': { id: 'C', lockedBy: null, value: 0, waitingQueue: [] },
            'D': { id: 'D', lockedBy: null, value: 0, waitingQueue: [] }
        };
        this.logs = [];
        this.history = [];
        this.stepCount = 0;
    }

    log(msg) {
        this.logs.push(`[Step ${this.stepCount}] ${msg}`);
    }

    enqueueTask(task) {
        this.tasksQueue.push({
            ...task,
            currentStepIndex: 0,
            status: 'queued'
        });
        this.log(`Enqueued task: ${task.name}`);
    }

    tick() {
        this.stepCount++;
        
        // 1. Assign queued tasks to idle threads
        for (let thread of this.threads) {
            if (thread.state === 'idle' && this.tasksQueue.length > 0) {
                const task = this.tasksQueue.shift();
                task.status = 'running';
                thread.currentTask = task;
                thread.state = 'running';
                this.log(`Thread ${thread.id} picked up task: ${task.name}`);
            }
        }

        // 2. Execute one step for each active/waiting thread
        for (let thread of this.threads) {
            if (thread.state === 'idle') continue;

            const task = thread.currentTask;
            if (!task) continue;

            const step = task.steps[task.currentStepIndex];
            if (!step) {
                // Task is done
                thread.state = 'idle';
                thread.currentTask = null;
                task.status = 'completed';
                this.log(`Thread ${thread.id} completed task: ${task.name}`);
                continue;
            }

            // Handle the current step based on its type
            if (thread.state === 'waiting') {
                // Thread is blocked on a resource. Check if it can acquire it.
                const neededRes = thread.waitingOnResource;
                const resource = this.resources[neededRes];
                
                if (resource.lockedBy === null) {
                    // Resource is now free! Grab it.
                    resource.lockedBy = thread.id;
                    thread.waitingOnResource = null;
                    thread.state = 'running';
                    this.log(`Thread ${thread.id} woke up and acquired Resource ${neededRes}`);
                    // Move to next step of the task
                    task.currentStepIndex++;
                } else {
                    // Still blocked
                    this.log(`Thread ${thread.id} still waiting on Resource ${neededRes}`);
                }
            } else if (thread.state === 'running') {
                if (step.type === 'compute') {
                    this.log(`Thread ${thread.id} performing computation for ${task.name}`);
                    task.currentStepIndex++;
                } else if (step.type === 'lock') {
                    const resId = step.resource;
                    const resource = this.resources[resId];
                    if (resource.lockedBy === null) {
                        resource.lockedBy = thread.id;
                        this.log(`Thread ${thread.id} locked Resource ${resId}`);
                        task.currentStepIndex++;
                    } else if (resource.lockedBy === thread.id) {
                        // Already locked by this thread
                        this.log(`Thread ${thread.id} already holds Resource ${resId}`);
                        task.currentStepIndex++;
                    } else {
                        // Blocked!
                        thread.state = 'waiting';
                        thread.waitingOnResource = resId;
                        resource.waitingQueue.push(thread.id);
                        this.log(`Thread ${thread.id} blocked trying to lock Resource ${resId} (held by Thread ${resource.lockedBy})`);
                    }
                } else if (step.type === 'unlock') {
                    const resId = step.resource;
                    const resource = this.resources[resId];
                    if (resource.lockedBy === thread.id) {
                        resource.lockedBy = null;
                        this.log(`Thread ${thread.id} unlocked Resource ${resId}`);
                        task.currentStepIndex++;
                    } else {
                        this.log(`Error: Thread ${thread.id} tried to unlock Resource ${resId} but did not hold it`);
                        task.currentStepIndex++;
                    }
                } else if (step.type === 'read') {
                    const resId = step.resource;
                    // Read current value into task local variable
                    task.localVal = this.resources[resId].value;
                    this.log(`Thread ${thread.id} read Resource ${resId} value = ${task.localVal}`);
                    task.currentStepIndex++;
                } else if (step.type === 'write') {
                    const resId = step.resource;
                    // Apply modification
                    const oldVal = this.resources[resId].value;
                    const newVal = step.valueModifier(task.localVal !== undefined ? task.localVal : oldVal);
                    this.resources[resId].value = newVal;
                    this.log(`Thread ${thread.id} wrote Resource ${resId} value: ${oldVal} -> ${newVal}`);
                    task.currentStepIndex++;
                } else if (step.type === 'yield') {
                    // Simulate context switch/yield
                    this.log(`Thread ${thread.id} yielded / context switched`);
                    task.currentStepIndex++;
                }
            }
        }

        // 3. Detect deadlock cycles
        const deadlocks = this.detectDeadlocks();
        if (deadlocks.length > 0) {
            this.log(`DEADLOCK DETECTED! Cycles: ${JSON.stringify(deadlocks)}`);
            for (let threadId of new Set(deadlocks.flat())) {
                const t = this.threads.find(th => th.id === threadId);
                if (t) t.state = 'deadlocked';
            }
        }
    }

    detectDeadlocks() {
        // Build dependency graph: threadId -> threadId (holding the resource we wait for)
        const adj = {};
        for (let thread of this.threads) {
            if ((thread.state === 'waiting' || thread.state === 'deadlocked') && thread.waitingOnResource) {
                const holder = this.resources[thread.waitingOnResource].lockedBy;
                if (holder !== null) {
                    adj[thread.id] = holder;
                }
            }
        }

        // Find all cycles in the graph
        const cycles = [];
        const visited = new Set();

        for (let startNode in adj) {
            const numStart = parseInt(startNode);
            if (visited.has(numStart)) continue;

            const path = [];
            const pathSet = new Set();
            let curr = numStart;

            while (curr !== undefined) {
                if (pathSet.has(curr)) {
                    // Cycle detected! Extract cycle
                    const cycleStartIdx = path.indexOf(curr);
                    const cycle = path.slice(cycleStartIdx);
                    cycles.push(cycle);
                    break;
                }
                if (visited.has(curr)) break;

                visited.add(curr);
                path.push(curr);
                pathSet.add(curr);
                curr = adj[curr];
            }
        }
        return cycles;
    }
}

// ==========================================
// TEST SUITE
// ==========================================
function runTests() {
    console.log("=== RUNNING CONCURRENCY SIMULATOR TESTS ===");
    
    // Test 1: Worker Pool Allocation
    (() => {
        console.log("\n--- Test 1: Worker Pool Allocation ---");
        const engine = new ConcurrencyEngine();
        
        // Enqueue 6 compute tasks
        for (let i = 1; i <= 6; i++) {
            engine.enqueueTask({
                name: `ComputeTask-${i}`,
                steps: [
                    { type: 'compute' },
                    { type: 'compute' }
                ]
            });
        }

        // Run until all completed or max ticks reached
        let ticks = 0;
        while (ticks < 10 && (engine.tasksQueue.length > 0 || engine.threads.some(t => t.state !== 'idle'))) {
            engine.tick();
            ticks++;
        }

        console.log(`Finished in ${ticks} ticks`);
        const allCompleted = engine.threads.every(t => t.currentTask === null);
        console.log(`All completed: ${allCompleted}`);
        if (!allCompleted) throw new Error("Test 1 failed: not all tasks finished");
    })();

    // Test 2: Race Condition (No Locks)
    (() => {
        console.log("\n--- Test 2: Race Condition (No Locks) ---");
        const engine = new ConcurrencyEngine();
        engine.resources['A'].value = 1000;

        // Task 1: Add 100
        engine.enqueueTask({
            name: "DepositTask",
            steps: [
                { type: 'read', resource: 'A' },
                { type: 'yield' }, // Simulates a context switch before write
                { type: 'write', resource: 'A', valueModifier: (val) => val + 100 }
            ]
        });

        // Task 2: Sub 100
        engine.enqueueTask({
            name: "WithdrawTask",
            steps: [
                { type: 'read', resource: 'A' },
                { type: 'yield' }, // Simulates a context switch before write
                { type: 'write', resource: 'A', valueModifier: (val) => val - 100 }
            ]
        });

        // Run ticks
        for (let i = 0; i < 5; i++) {
            engine.tick();
        }

        const finalBalance = engine.resources['A'].value;
        console.log(`Final balance (expected corrupted): $${finalBalance}`);
        // Because of the context switch:
        // T1 reads 1000
        // T2 reads 1000
        // T1 writes 1000 + 100 = 1100
        // T2 writes 1000 - 100 = 900
        // The final balance should be 900 (corrupted) instead of 1000
        console.log(`Corrupted: ${finalBalance !== 1000}`);
        if (finalBalance === 1000) throw new Error("Test 2 failed: race condition did not corrupt data");
    })();

    // Test 3: Thread-Safe with Locks
    (() => {
        console.log("\n--- Test 3: Thread-Safe with Locks ---");
        const engine = new ConcurrencyEngine();
        engine.resources['A'].value = 1000;

        // Task 1: Add 100 with Mutex A
        engine.enqueueTask({
            name: "SafeDepositTask",
            steps: [
                { type: 'lock', resource: 'A' },
                { type: 'read', resource: 'A' },
                { type: 'yield' },
                { type: 'write', resource: 'A', valueModifier: (val) => val + 100 },
                { type: 'unlock', resource: 'A' }
            ]
        });

        // Task 2: Sub 100 with Mutex A
        engine.enqueueTask({
            name: "SafeWithdrawTask",
            steps: [
                { type: 'lock', resource: 'A' },
                { type: 'read', resource: 'A' },
                { type: 'yield' },
                { type: 'write', resource: 'A', valueModifier: (val) => val - 100 },
                { type: 'unlock', resource: 'A' }
            ]
        });

        // Run until done
        let ticks = 0;
        while (ticks < 12 && (engine.tasksQueue.length > 0 || engine.threads.some(t => t.state !== 'idle'))) {
            engine.tick();
            ticks++;
        }

        const finalBalance = engine.resources['A'].value;
        console.log(`Final balance (expected safe): $${finalBalance}`);
        console.log(`Is Safe: ${finalBalance === 1000}`);
        if (finalBalance !== 1000) throw new Error("Test 3 failed: locking did not protect the balance");
    })();

    // Test 4: Deadlock Cycle Detection
    (() => {
        console.log("\n--- Test 4: Deadlock Cycle Detection ---");
        const engine = new ConcurrencyEngine();

        // Thread 1 locks A, wants B
        engine.enqueueTask({
            name: "DeadlockTask-1",
            steps: [
                { type: 'lock', resource: 'A' },
                { type: 'yield' }, // let T2 lock B
                { type: 'lock', resource: 'B' },
                { type: 'unlock', resource: 'B' },
                { type: 'unlock', resource: 'A' }
            ]
        });

        // Thread 2 locks B, wants A
        engine.enqueueTask({
            name: "DeadlockTask-2",
            steps: [
                { type: 'lock', resource: 'B' },
                { type: 'yield' }, // let T1 lock A
                { type: 'lock', resource: 'A' },
                { type: 'unlock', resource: 'A' },
                { type: 'unlock', resource: 'B' }
            ]
        });

        // Run ticks to induce deadlock
        for (let i = 0; i < 5; i++) {
            engine.tick();
        }

        // Check if deadlocks are detected
        const deadlocks = engine.detectDeadlocks();
        console.log("Detected Deadlock Cycles:", deadlocks);
        if (deadlocks.length === 0) {
            throw new Error("Test 4 failed: deadlock cycle was not detected");
        }
        
        const hasT1 = deadlocks[0].includes(1);
        const hasT2 = deadlocks[0].includes(2);
        console.log(`Cycle contains Thread 1: ${hasT1}, Thread 2: ${hasT2}`);
        if (!hasT1 || !hasT2) {
            throw new Error("Test 4 failed: cycle does not contain the expected threads");
        }
        console.log("All tests passed successfully!");
    })();
}

runTests();
