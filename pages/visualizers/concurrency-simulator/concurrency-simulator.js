/**
 * concurrency-simulator.js
 * Implements a Visual Concurrency and Deadlock simulator using 
 * SharedArrayBuffer, Web Workers, and the Atomics API.
 */

document.addEventListener("DOMContentLoaded", () => {
    initSimulator();
});

// App State
let sab, view;
let worker1, worker2;
let animationReq;

// Memory Layout Constants (Indexes in Int32Array)
const IDX_BALANCE = 0;
const IDX_MUTEX_A = 1;
const IDX_MUTEX_B = 2;
const IDX_STATE_T1 = 3; // 0=Idle, 1=Working, 2=Waiting
const IDX_STATE_T2 = 4;

const INITIAL_BALANCE = 1000;

// DOM Elements
const els = {
    sabWarning: document.getElementById('sabWarning'),
    mainWorkspace: document.getElementById('mainWorkspace'),
    
    // Controls
    btnRace: document.getElementById('btnRace'),
    btnSafe: document.getElementById('btnSafe'),
    btnDeadlock: document.getElementById('btnDeadlock'),
    btnReset: document.getElementById('btnReset'),
    
    // Visuals
    uiBalance: document.getElementById('uiBalance'),
    memoryVault: document.querySelector('.memory-vault'),
    
    uiMutex1: document.getElementById('uiMutex1'),
    iconMutex1: document.getElementById('iconMutex1'),
    uiMutex2: document.getElementById('uiMutex2'),
    iconMutex2: document.getElementById('iconMutex2'),
    
    statusT1: document.getElementById('statusT1'),
    statusT2: document.getElementById('statusT2'),
    uiThread1: document.getElementById('uiThread1'),
    uiThread2: document.getElementById('uiThread2'),
    
    logContainer: document.getElementById('logContainer')
};

// ==========================================
// 1. INITIALIZATION & SAB CHECK
// ==========================================
function initSimulator() {
    // Check if SharedArrayBuffer is available (Requires Cross-Origin-Isolation)
    if (typeof SharedArrayBuffer === 'undefined') {
        els.sabWarning.classList.remove('hidden');
        els.mainWorkspace.style.filter = 'blur(5px)';
        return;
    }

    allocateMemory();
    createWorkers();
    bindEvents();
    startUILoop();
}

function allocateMemory() {
    // 5 slots of 32-bit integers (20 bytes total)
    sab = new SharedArrayBuffer(5 * 4);
    view = new Int32Array(sab);
    resetMemory();
}

function resetMemory() {
    view[IDX_BALANCE] = INITIAL_BALANCE;
    view[IDX_MUTEX_A] = 0; // 0 = Unlocked
    view[IDX_MUTEX_B] = 0;
    view[IDX_STATE_T1] = 0; // 0 = Idle
    view[IDX_STATE_T2] = 0;
}

// ==========================================
// 2. WEB WORKER GENERATOR (Blob)
// ==========================================
// By using a Blob, we avoid needing a separate file server path for the worker.
const workerCode = `
self.onmessage = function(e) {
    const { sab, mode, threadId } = e.data;
    const view = new Int32Array(sab);

    // Indexes
    const BALANCE = 0;
    const MUTEX_A = 1;
    const MUTEX_B = 2;
    const STATE = threadId === 1 ? 3 : 4;

    function log(msg) {
        self.postMessage({ type: 'log', threadId, msg });
    }

    // Hardware-level Spinlock + OS Wait
    function lock(mutexIdx, mutexName) {
        log('Attempting to acquire ' + mutexName);
        Atomics.store(view, STATE, 2); // 2 = WAITING
        
        // compareExchange: if memory at mutexIdx is 0, set to 1. Returns original value.
        // If it returns 1, someone else holds the lock.
        while (Atomics.compareExchange(view, mutexIdx, 0, 1) === 1) {
            log('Blocked! Waiting on ' + mutexName);
            // OS-level sleep until notified. The '1' means sleep if value is still '1'.
            Atomics.wait(view, mutexIdx, 1);
        }
        
        Atomics.store(view, STATE, 1); // 1 = WORKING
        log('Acquired ' + mutexName);
    }

    function unlock(mutexIdx, mutexName) {
        Atomics.store(view, mutexIdx, 0); // Set to unlocked
        Atomics.notify(view, mutexIdx, 1); // Wake up 1 waiting thread
        log('Released ' + mutexName);
    }

    // Simulates CPU time inside a critical section (Busy wait)
    function simulateWork(ms) {
        const start = Date.now();
        while(Date.now() - start < ms) {}
    }

    const modifier = threadId === 1 ? 100 : -100; // T1 deposits, T2 withdraws

    if (mode === 'race') {
        log('Started RACE CONDITION execution');
        Atomics.store(view, STATE, 1);
        for(let i = 0; i < 5; i++) {
            // Read
            let currentBalance = view[BALANCE];
            // Context Switch / Delay
            simulateWork(300); 
            // Write
            view[BALANCE] = currentBalance + modifier;
        }
        Atomics.store(view, STATE, 0); // IDLE
        log('Finished execution');
    }
    
    else if (mode === 'safe') {
        log('Started THREAD-SAFE execution');
        for(let i = 0; i < 5; i++) {
            lock(MUTEX_A, 'Mutex A');
            
            // Critical Section
            let currentBalance = view[BALANCE];
            simulateWork(300);
            view[BALANCE] = currentBalance + modifier;
            
            unlock(MUTEX_A, 'Mutex A');
            
            // Brief pause to allow the other thread to grab the lock
            simulateWork(100); 
        }
        Atomics.store(view, STATE, 0); // IDLE
        log('Finished execution');
    }
    
    else if (mode === 'deadlock') {
        log('Started DEADLOCK simulation');
        if (threadId === 1) {
            lock(MUTEX_A, 'Mutex A');
            simulateWork(500); // Give T2 time to lock B
            lock(MUTEX_B, 'Mutex B'); // Will freeze here forever
            
            // Unreachable
            unlock(MUTEX_B, 'Mutex B');
            unlock(MUTEX_A, 'Mutex A');
        } else {
            lock(MUTEX_B, 'Mutex B');
            simulateWork(500); // Give T1 time to lock A
            lock(MUTEX_A, 'Mutex A'); // Will freeze here forever
            
            // Unreachable
            unlock(MUTEX_A, 'Mutex A');
            unlock(MUTEX_B, 'Mutex B');
        }
    }
};
`;

function createWorkers() {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    
    worker1 = new Worker(workerUrl);
    worker2 = new Worker(workerUrl);

    // Setup logging receivers
    worker1.onmessage = (e) => handleWorkerLog(e.data);
    worker2.onmessage = (e) => handleWorkerLog(e.data);
}

function handleWorkerLog(data) {
    if (data.type !== 'log') return;
    const div = document.createElement('div');
    div.className = `log-entry t${data.threadId}`;
    div.textContent = `[Thread ${data.threadId}] ${data.msg}`;
    els.logContainer.appendChild(div);
    els.logContainer.scrollTop = els.logContainer.scrollHeight;
}

function logSys(msg) {
    const div = document.createElement('div');
    div.className = `log-entry sys`;
    div.textContent = `> ${msg}`;
    els.logContainer.appendChild(div);
    els.logContainer.scrollTop = els.logContainer.scrollHeight;
}

// ==========================================
// 3. UI CONTROLS & RENDER LOOP
// ==========================================
function bindEvents() {
    const disableBtns = () => {
        els.btnRace.disabled = true;
        els.btnSafe.disabled = true;
        els.btnDeadlock.disabled = true;
        els.memoryVault.classList.remove('corrupted');
    };

    els.btnRace.addEventListener('click', () => {
        disableBtns();
        logSys("Triggering RACE CONDITION. No locks deployed.");
        worker1.postMessage({ sab, mode: 'race', threadId: 1 });
        worker2.postMessage({ sab, mode: 'race', threadId: 2 });
    });

    els.btnSafe.addEventListener('click', () => {
        disableBtns();
        logSys("Triggering SAFE EXECUTION. Mutex locks engaged.");
        worker1.postMessage({ sab, mode: 'safe', threadId: 1 });
        worker2.postMessage({ sab, mode: 'safe', threadId: 2 });
    });

    els.btnDeadlock.addEventListener('click', () => {
        disableBtns();
        logSys("Triggering MUTUAL DEADLOCK. Threads crossing Mutex requests.");
        worker1.postMessage({ sab, mode: 'deadlock', threadId: 1 });
        worker2.postMessage({ sab, mode: 'deadlock', threadId: 2 });
    });

    els.btnReset.addEventListener('click', () => {
        // Terminate existing workers to kill any stuck wait() calls
        if (worker1) worker1.terminate();
        if (worker2) worker2.terminate();
        
        logSys("System Reset. Threads killed. Memory cleared.");
        
        // Clean up UI & Memory
        els.logContainer.innerHTML = '';
        els.btnRace.disabled = false;
        els.btnSafe.disabled = false;
        els.btnDeadlock.disabled = false;
        els.memoryVault.classList.remove('corrupted');
        
        resetMemory();
        createWorkers(); // Spawn fresh threads
    });
}

function startUILoop() {
    function loop() {
        if (view) {
            updateUIFromMemory();
        }
        animationReq = requestAnimationFrame(loop);
    }
    loop();
}

function updateUIFromMemory() {
    // 1. Update Balance
    const currentBalance = view[IDX_BALANCE];
    els.uiBalance.textContent = `$${currentBalance}`;
    
    // Highlight corruption if finished and balance is wrong
    const t1State = view[IDX_STATE_T1];
    const t2State = view[IDX_STATE_T2];
    if (t1State === 0 && t2State === 0 && currentBalance !== INITIAL_BALANCE) {
        els.memoryVault.classList.add('corrupted');
    }

    // 2. Update Mutex Locks
    updateMutexUI(els.uiMutex1, els.iconMutex1, view[IDX_MUTEX_A]);
    updateMutexUI(els.uiMutex2, els.iconMutex2, view[IDX_MUTEX_B]);

    // 3. Update Thread States (0=Idle, 1=Working, 2=Waiting)
    // Deadlock detection: If both are waiting, they are deadlocked
    const isDeadlocked = (t1State === 2 && t2State === 2);
    
    updateThreadUI(els.statusT1, t1State, isDeadlocked);
    updateThreadUI(els.statusT2, t2State, isDeadlocked);
}

function updateMutexUI(container, icon, state) {
    if (state === 1) {
        container.className = 'mutex-lock locked';
        icon.className = 'fas fa-lock';
    } else {
        container.className = 'mutex-lock unlocked';
        icon.className = 'fas fa-lock-open';
    }
}

function updateThreadUI(statusEl, state, isDeadlocked) {
    if (isDeadlocked) {
        statusEl.className = 'thread-status deadlock';
        statusEl.textContent = 'DEADLOCKED';
        return;
    }

    switch(state) {
        case 0:
            statusEl.className = 'thread-status idle';
            statusEl.textContent = 'IDLE';
            break;
        case 1:
            statusEl.className = 'thread-status working';
            statusEl.textContent = 'WORKING';
            break;
        case 2:
            statusEl.className = 'thread-status waiting';
            statusEl.textContent = 'WAITING';
            break;
    }
}
