/**
 * dht-visualizer.js
 * Visualizes Consistent Hashing on a Hash Ring using the HTML5 Canvas API.
 * Demonstrates node distribution, data (key) migration, and Virtual Nodes.
 */

document.addEventListener("DOMContentLoaded", () => {
    initDHTVisualizer();
});

// ==========================================
// 1. ENGINE STATE & CONFIG
// ==========================================
const CONFIG = {
    RING_RADIUS_RATIO: 0.35, // Relative to canvas min(width, height)
    VNODES_PER_SERVER: 5,
    COLORS: ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#eab308', '#6366f1']
};

let state = {
    servers: [], // { id, name, color, hashes: [] }
    keys: [],    // { id, angle, currentServerId, targetServerId, color, radiusOffset }
    useVNodes: false,
    serverCounter: 1,
    chartInstance: null,
    animationReq: null,
    hoveredServer: null
};

const els = {
    canvas: document.getElementById('dhtCanvas'),
    wrapper: document.getElementById('canvasWrapper'),
    tooltip: document.getElementById('canvasTooltip'),
    
    btnAddServer: document.getElementById('btnAddServer'),
    btnKillServer: document.getElementById('btnKillServer'),
    btnGenerateKeys: document.getElementById('btnGenerateKeys'),
    btnReset: document.getElementById('btnReset'),
    vNodeToggle: document.getElementById('vNodeToggle'),
    
    stdDevValue: document.getElementById('stdDevValue'),
    keyCountDisplay: document.getElementById('keyCountDisplay'),
    logContainer: document.getElementById('logContainer')
};

let ctx;

// ==========================================
// 2. INITIALIZATION
// ==========================================
function initDHTVisualizer() {
    ctx = els.canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    initChart();
    bindEvents();
    
    // Setup Initial Cluster (3 Servers)
    addServer();
    addServer();
    addServer();
    
    startRenderLoop();
}

function resizeCanvas() {
    const rect = els.wrapper.getBoundingClientRect();
    // Support high-DPI displays for crisp rendering
    els.canvas.width = rect.width * window.devicePixelRatio;
    els.canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    els.canvas.style.width = `${rect.width}px`;
    els.canvas.style.height = `${rect.height}px`;
}

function logMsg(msg, type = 'sys') {
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.textContent = `> ${msg}`;
    els.logContainer.appendChild(div);
    els.logContainer.scrollTop = els.logContainer.scrollHeight;
}

function bindEvents() {
    els.btnAddServer.addEventListener('click', () => {
        addServer();
        recalculateKeys();
    });
    
    els.btnKillServer.addEventListener('click', () => {
        if (state.servers.length <= 1) return alert("Cannot kill the last server.");
        // Pick a random server
        const idx = Math.floor(Math.random() * state.servers.length);
        const serverToKill = state.servers[idx];
        removeServer(serverToKill.id);
    });

    els.btnGenerateKeys.addEventListener('click', () => {
        generateKeys(1000);
        recalculateKeys();
    });

    els.btnReset.addEventListener('click', () => {
        state.servers = [];
        state.keys = [];
        state.serverCounter = 1;
        els.logContainer.innerHTML = '';
        updateChart();
        addServer(); addServer(); addServer();
        logMsg("Cluster reset to 3 nodes.", "sys");
    });

    els.vNodeToggle.addEventListener('change', (e) => {
        state.useVNodes = e.target.checked;
        logMsg(state.useVNodes ? "Virtual Nodes ENABLED." : "Virtual Nodes DISABLED.", "vnode");
        
        // Re-hash all servers
        state.servers.forEach(s => generateServerHashes(s));
        recalculateKeys();
    });

    // Canvas Hover Interaction (Tooltips)
    els.canvas.addEventListener('mousemove', handleCanvasMouseMove);
    els.canvas.addEventListener('mouseout', () => {
        els.tooltip.classList.add('hidden');
        state.hoveredServer = null;
    });
}

// ==========================================
// 3. CORE HASH RING LOGIC
// ==========================================

// Simple deterministic hash mapping a string to 0.0 - 360.0 degrees
function hashStringToAngle(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    // Normalize to positive 0 - 360
    return Math.abs(hash) % 360;
}

function generateServerHashes(server) {
    server.hashes = [];
    const count = state.useVNodes ? CONFIG.VNODES_PER_SERVER : 1;
    for (let i = 0; i < count; i++) {
        // Hashing the server name + replica index ensures deterministic pseudo-random spread
        const hashStr = `${server.id}-replica-${i}`;
        server.hashes.push(hashStringToAngle(hashStr));
    }
    // Sort hashes for binary search optimization (optional, standard array sort is fine for small N)
    server.hashes.sort((a, b) => a - b);
}

function addServer() {
    const id = `S${state.serverCounter++}`;
    const color = CONFIG.COLORS[state.servers.length % CONFIG.COLORS.length];
    
    const server = { id, name: `Node ${id}`, color, hashes: [] };
    generateServerHashes(server);
    state.servers.push(server);
    
    logMsg(`Added ${server.name} to the ring.`, 'add');
    if(state.keys.length > 0) recalculateKeys();
    else updateChart();
}

function removeServer(id) {
    const s = state.servers.find(s => s.id === id);
    if (!s) return;
    
    state.servers = state.servers.filter(server => server.id !== id);
    logMsg(`Killed ${s.name}. Keys are migrating to neighbors...`, 'kill');
    recalculateKeys();
}

function generateKeys(count) {
    for (let i = 0; i < count; i++) {
        const id = `K-${Date.now()}-${Math.random()}`;
        const angle = hashStringToAngle(id);
        
        state.keys.push({
            id: id,
            angle: angle,
            currentServerId: null,
            targetServerId: null,
            color: '#475569',
            // Jitter offsets keys radially so they don't draw perfectly on top of the line
            radiusOffset: (Math.random() - 0.5) * 40 
        });
    }
    els.keyCountDisplay.textContent = state.keys.length;
    logMsg(`Generated ${count} data keys.`, 'sys');
}

/**
 * The Consistent Hashing Assignment Algorithm:
 * Finds the first server hash angle clockwise from the key's angle.
 */
function recalculateKeys() {
    if (state.servers.length === 0 || state.keys.length === 0) return;

    // 1. Flatten and sort all server hashes into a single ring
    let ring = [];
    state.servers.forEach(server => {
        server.hashes.forEach(angle => {
            ring.push({ angle, serverId: server.id, color: server.color });
        });
    });
    ring.sort((a, b) => a.angle - b.angle);

    // 2. Route every key
    state.keys.forEach(key => {
        // Binary search or linear scan to find the first server angle >= key.angle
        let target = ring.find(node => node.angle >= key.angle);
        
        // Wrap-around to the first node if the key is past the last node on the ring
        if (!target) target = ring[0];
        
        key.targetServerId = target.serverId;
        
        // If it's a new assignment, it will animate its color in the render loop.
        // For immediate visual snapping of orphaned keys:
        if (key.currentServerId === null || !state.servers.find(s=>s.id === key.currentServerId)) {
            key.currentServerId = target.serverId;
            key.color = target.color;
        }
    });

    updateChart();
}

// ==========================================
// 4. CHART.JS & TELEMETRY
// ==========================================
function initChart() {
    const canvas = document.getElementById('distributionChart');
    state.chartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Keys per Server', data: [], backgroundColor: [] }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#cbd5e1', font: { family: 'Fira Code' } } }
            },
            plugins: { legend: { display: false } },
            animation: { duration: 500 }
        }
    });
}

function updateChart() {
    if (!state.chartInstance) return;

    // Count keys per server
    const distribution = {};
    state.servers.forEach(s => distribution[s.id] = 0);
    state.keys.forEach(k => {
        if (distribution[k.targetServerId] !== undefined) {
            distribution[k.targetServerId]++;
        }
    });

    const labels = [];
    const data = [];
    const bgColors = [];

    state.servers.forEach(s => {
        labels.push(s.name);
        data.push(distribution[s.id]);
        bgColors.push(s.color);
    });

    state.chartInstance.data.labels = labels;
    state.chartInstance.data.datasets[0].data = data;
    state.chartInstance.data.datasets[0].backgroundColor = bgColors;
    state.chartInstance.update();

    // Calculate Standard Deviation to prove vNodes work
    if (data.length > 0) {
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
        const stdDev = Math.sqrt(variance);
        els.stdDevValue.textContent = stdDev.toFixed(2);
        
        // Color code standard dev
        if(stdDev > 150) els.stdDevValue.style.color = '#ef4444'; // Red (Hotspots!)
        else if (stdDev > 50) els.stdDevValue.style.color = '#f59e0b'; // Amber
        else els.stdDevValue.style.color = '#10b981'; // Green (Balanced)
    } else {
        els.stdDevValue.textContent = "0.00";
    }
}

// ==========================================
// 5. CANVAS RENDER LOOP
// ==========================================
function startRenderLoop() {
    function loop() {
        render();
        state.animationReq = requestAnimationFrame(loop);
    }
    loop();
}

function render() {
    const w = els.canvas.clientWidth;
    const h = els.canvas.clientHeight;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * CONFIG.RING_RADIUS_RATIO;

    // Clear Canvas
    ctx.clearRect(0, 0, w, h);

    // 1. Draw Base Ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 2. Draw Keys
    state.keys.forEach(key => {
        const rad = (key.angle - 90) * (Math.PI / 180); // -90 to start at 12 o'clock
        const r = radius + key.radiusOffset;
        const x = cx + r * Math.cos(rad);
        const y = cy + r * Math.sin(rad);

        // Animate color transition if target changed
        if (key.currentServerId !== key.targetServerId) {
            const targetServer = state.servers.find(s => s.id === key.targetServerId);
            if (targetServer) {
                key.currentServerId = targetServer.id;
                key.color = targetServer.color;
            }
        }

        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = key.color;
        
        // Add glow if migrating or hovered
        if (state.hoveredServer && key.currentServerId === state.hoveredServer) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = key.color;
            ctx.fillStyle = '#fff'; // Highlight
        } else {
            ctx.shadowBlur = 0;
        }
        
        ctx.fill();
    });
    
    // Reset shadow for next draws
    ctx.shadowBlur = 0;

    // 3. Draw Servers & Virtual Nodes
    state.servers.forEach(server => {
        server.hashes.forEach((angle, idx) => {
            const rad = (angle - 90) * (Math.PI / 180);
            const x = cx + radius * Math.cos(rad);
            const y = cy + radius * Math.sin(rad);
            
            const isPhysical = (idx === 0); // Define the first hash as the "Physical" representation
            const isHovered = (server.id === state.hoveredServer);
            
            ctx.beginPath();
            if (isPhysical && !state.useVNodes) {
                // Physical Node
                ctx.arc(x, y, 10, 0, 2 * Math.PI);
                ctx.fillStyle = '#020617';
                ctx.fill();
                ctx.lineWidth = isHovered ? 4 : 2;
                ctx.strokeStyle = server.color;
                ctx.shadowBlur = isHovered ? 20 : 10;
                ctx.shadowColor = server.color;
                ctx.stroke();
            } else {
                // Virtual Node (or physical representation in vNode mode)
                ctx.arc(x, y, isPhysical ? 8 : 5, 0, 2 * Math.PI);
                ctx.fillStyle = isPhysical ? server.color : '#020617';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = server.color;
                ctx.shadowBlur = isHovered ? 15 : 5;
                ctx.shadowColor = server.color;
                ctx.stroke();
            }
            
            // Save coordinates for mouse interaction
            if (isPhysical) {
                server.renderX = x;
                server.renderY = y;
            }
        });
    });
    ctx.shadowBlur = 0;
}

// Canvas Mouse Interaction for Tooltips
function handleCanvasMouseMove(e) {
    const rect = els.canvas.getBoundingClientRect();
    // Adjust for High-DPI scaling
    const scaleX = els.canvas.width / rect.width;
    const scaleY = els.canvas.height / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    
    let hovered = null;
    
    // Check intersection with server nodes
    state.servers.forEach(server => {
        if (!server.renderX || !server.renderY) return;
        // Hitbox distance logic
        const dist = Math.hypot(server.renderX - mouseX, server.renderY - mouseY);
        if (dist < 20 * window.devicePixelRatio) {
            hovered = server;
        }
    });
    
    if (hovered) {
        state.hoveredServer = hovered.id;
        els.tooltip.textContent = `${hovered.name} (${state.keys.filter(k=>k.currentServerId===hovered.id).length} Keys)`;
        els.tooltip.style.left = `${e.clientX - rect.left}px`;
        els.tooltip.style.top = `${e.clientY - rect.top - 15}px`;
        els.tooltip.classList.remove('hidden');
        els.canvas.style.cursor = 'pointer';
    } else {
        state.hoveredServer = null;
        els.tooltip.classList.add('hidden');
        els.canvas.style.cursor = 'default';
    }
}
