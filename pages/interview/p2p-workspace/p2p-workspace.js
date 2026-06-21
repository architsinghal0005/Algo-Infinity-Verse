/**
 * p2p-workspace.js
 * Implements a serverless WebRTC Peer-to-Peer architecture.
 * Handles the manual SDP handshake, DataChannel creation, and CodeMirror syncing.
 */

document.addEventListener("DOMContentLoaded", () => {
    initP2PWorkspace();
});

// --- DOM Elements ---
const els = {
    btnOpenHandshake: document.getElementById('btnOpenHandshake'),
    btnDisconnect: document.getElementById('btnDisconnect'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    networkBadge: document.getElementById('networkBadge'),
    latencyMeter: document.getElementById('latencyMeter'),
    pingValue: document.getElementById('pingValue'),
    
    systemLogs: document.getElementById('systemLogs'),
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    btnSendChat: document.getElementById('btnSendChat'),
    editorContainer: document.getElementById('editorContainer'),
    
    // Modal
    handshakeModal: document.getElementById('handshakeModal'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Host Flow
    btnGenerateOffer: document.getElementById('btnGenerateOffer'),
    hostOfferToken: document.getElementById('hostOfferToken'),
    btnCopyOffer: document.getElementById('btnCopyOffer'),
    hostAnswerToken: document.getElementById('hostAnswerToken'),
    btnConnectHost: document.getElementById('btnConnectHost'),
    
    // Join Flow
    guestOfferToken: document.getElementById('guestOfferToken'),
    btnAcceptOffer: document.getElementById('btnAcceptOffer'),
    guestReplySection: document.getElementById('guestReplySection'),
    guestAnswerToken: document.getElementById('guestAnswerToken'),
    btnCopyAnswer: document.getElementById('btnCopyAnswer')
};

// --- App State ---
let editor;
let peerConnection;
let dataChannel;
let isRemoteUpdate = false; // Prevents infinite loops in CodeMirror
let pingInterval;

// Public STUN servers to bypass NAT routers
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

function initP2PWorkspace() {
    // 1. Initialize CodeMirror
    editor = CodeMirror(els.editorContainer, {
        lineNumbers: true,
        theme: 'material-ocean',
        mode: 'javascript',
        value: `// Peer-to-Peer Workspace Initialized.\n// Any code written here will sync directly to your peer.\n\nfunction p2pTest() {\n    console.log("Hello WebRTC!");\n}\n`,
        indentUnit: 4,
        matchBrackets: true
    });

    // Editor Change Listener (Syncing)
    editor.on('change', (cm, changeObj) => {
        if (!isRemoteUpdate && dataChannel && dataChannel.readyState === 'open') {
            // Send the change object over the DataChannel
            const payload = {
                type: 'code-sync',
                change: changeObj
            };
            dataChannel.send(JSON.stringify(payload));
        }
    });

    // 2. Bind UI Events
    els.btnOpenHandshake.addEventListener('click', () => els.handshakeModal.classList.remove('hidden'));
    els.btnCloseModal.addEventListener('click', () => els.handshakeModal.classList.add('hidden'));
    els.btnDisconnect.addEventListener('click', disconnectP2P);
    
    els.btnSendChat.addEventListener('click', sendChatMessage);
    els.chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });

    // Modal Tab Switching
    els.tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            els.tabBtns.forEach(b => b.classList.remove('active'));
            els.tabContents.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(`tab-${e.target.dataset.tab}`).classList.add('active');
        });
    });

    // WebRTC Buttons
    els.btnGenerateOffer.addEventListener('click', handleCreateOffer);
    els.btnConnectHost.addEventListener('click', handleProcessAnswer);
    els.btnAcceptOffer.addEventListener('click', handleAcceptOffer);
    
    setupClipboardButtons();
}

function logSys(msg, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    els.systemLogs.appendChild(entry);
    els.systemLogs.scrollTop = els.systemLogs.scrollHeight;
}

// ==========================================
// WEBRTC CORE LOGIC (THE HANDSHAKE)
// ==========================================

function initPeerConnection() {
    if (peerConnection) peerConnection.close();
    
    peerConnection = new RTCPeerConnection(rtcConfig);
    
    // Listen for data channel created by the other peer (Guest side)
    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannelEvents();
    };

    // Connection State Logging
    peerConnection.onconnectionstatechange = () => {
        logSys(`Connection state: ${peerConnection.connectionState}`, 'sys');
        if (peerConnection.connectionState === 'connected') {
            onConnected();
        } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
            onDisconnected();
        }
    };
}

// --- HOST FLOW ---
async function handleCreateOffer() {
    els.btnGenerateOffer.disabled = true;
    els.btnGenerateOffer.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    
    initPeerConnection();
    
    // Host creates the data channel
    dataChannel = peerConnection.createDataChannel('codeSyncChannel');
    setupDataChannelEvents();

    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Wait for ICE gathering to complete before creating the token
        peerConnection.onicecandidate = (event) => {
            if (event.candidate === null) {
                // Gathering finished, encode the full SDP and ICE candidates
                const token = btoa(JSON.stringify(peerConnection.localDescription));
                els.hostOfferToken.value = token;
                els.btnGenerateOffer.style.display = 'none';
                els.btnCopyOffer.classList.remove('hidden');
                logSys('Offer Token generated successfully.', 'success');
            }
        };
    } catch (err) {
        logSys(`Error creating offer: ${err}`, 'error');
    }
}

async function handleProcessAnswer() {
    const answerToken = els.hostAnswerToken.value.trim();
    if (!answerToken) return alert("Please paste the Reply Token.");

    try {
        const answerSDP = JSON.parse(atob(answerToken));
        await peerConnection.setRemoteDescription(answerSDP);
        logSys('Remote description set. Finalizing connection...', 'info');
        els.handshakeModal.classList.add('hidden');
    } catch (err) {
        alert("Invalid Reply Token.");
        logSys(`Error setting remote description: ${err}`, 'error');
    }
}

// --- GUEST FLOW ---
async function handleAcceptOffer() {
    const offerToken = els.guestOfferToken.value.trim();
    if (!offerToken) return alert("Please paste the Invite Token from the host.");

    els.btnAcceptOffer.disabled = true;
    els.btnAcceptOffer.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    initPeerConnection();

    try {
        const offerSDP = JSON.parse(atob(offerToken));
        await peerConnection.setRemoteDescription(offerSDP);
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Wait for ICE gathering
        peerConnection.onicecandidate = (event) => {
            if (event.candidate === null) {
                const token = btoa(JSON.stringify(peerConnection.localDescription));
                els.guestAnswerToken.value = token;
                els.btnAcceptOffer.style.display = 'none';
                els.guestReplySection.classList.remove('hidden');
                logSys('Answer Token generated. Waiting for Host.', 'success');
            }
        };
    } catch (err) {
        alert("Invalid Invite Token.");
        logSys(`Error accepting offer: ${err}`, 'error');
        els.btnAcceptOffer.disabled = false;
        els.btnAcceptOffer.textContent = 'Accept & Generate Reply';
    }
}

// ==========================================
// DATA CHANNEL LOGIC (SYNCING)
// ==========================================

function setupDataChannelEvents() {
    dataChannel.onopen = () => {
        logSys('DataChannel opened. Encryption active.', 'success');
        startLatencyPing();
    };

    dataChannel.onclose = () => {
        logSys('DataChannel closed.', 'error');
    };

    dataChannel.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // Handle Code Sync
            if (data.type === 'code-sync') {
                applyRemoteEdit(data.change);
            } 
            // Handle Chat
            else if (data.type === 'chat') {
                renderChat('Peer', data.message, 'peer');
            }
            // Handle Latency Ping
            else if (data.type === 'ping') {
                dataChannel.send(JSON.stringify({ type: 'pong', time: data.time }));
            }
            // Handle Latency Pong
            else if (data.type === 'pong') {
                const latency = Date.now() - data.time;
                els.pingValue.textContent = latency;
            }
        } catch (e) {
            console.error("Parse error on incoming message", e);
        }
    };
}

function applyRemoteEdit(change) {
    isRemoteUpdate = true; // Lock editor listener
    
    // CodeMirror replaceRange elegantly handles exact line/char insertions
    editor.replaceRange(change.text.join('\n'), change.from, change.to, 'remote');
    
    isRemoteUpdate = false; // Unlock
}

function sendChatMessage() {
    const text = els.chatInput.value.trim();
    if (!text || !dataChannel || dataChannel.readyState !== 'open') return;

    // Render locally
    renderChat('You', text, 'self');
    els.chatInput.value = '';

    // Send over P2P
    dataChannel.send(JSON.stringify({
        type: 'chat',
        message: text
    }));
}

function renderChat(sender, text, type) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${type}`;
    msgDiv.textContent = type === 'self' ? text : `${sender}: ${text}`;
    els.chatMessages.appendChild(msgDiv);
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

// ==========================================
// UI / UX STATE MANAGEMENT
// ==========================================

function onConnected() {
    els.handshakeModal.classList.add('hidden');
    els.btnOpenHandshake.classList.add('hidden');
    els.btnDisconnect.classList.remove('hidden');
    
    els.statusDot.className = 'dot online';
    els.statusText.textContent = 'Connected (P2P)';
    els.statusText.style.color = 'var(--p2p-primary)';
    
    els.networkBadge.className = 'network-badge online';
    els.networkBadge.innerHTML = '<i class="fas fa-wifi"></i> P2P Network: Online';
    
    els.latencyMeter.classList.remove('hidden');
    els.chatInput.disabled = false;
    els.btnSendChat.disabled = false;
    els.chatInput.placeholder = "Message peer directly...";
}

function onDisconnected() {
    clearInterval(pingInterval);
    els.btnOpenHandshake.classList.remove('hidden');
    els.btnDisconnect.classList.add('hidden');
    
    els.statusDot.className = 'dot';
    els.statusText.textContent = 'Disconnected';
    els.statusText.style.color = '#64748b';
    
    els.networkBadge.className = 'network-badge';
    els.networkBadge.innerHTML = '<i class="fas fa-wifi"></i> P2P Network: Offline';
    
    els.latencyMeter.classList.add('hidden');
    els.chatInput.disabled = true;
    els.btnSendChat.disabled = true;
    
    // Reset Modal UI
    els.btnGenerateOffer.style.display = 'block';
    els.btnGenerateOffer.disabled = false;
    els.btnGenerateOffer.innerHTML = 'Generate Token';
    els.btnCopyOffer.classList.add('hidden');
    els.hostOfferToken.value = '';
    els.hostAnswerToken.value = '';
    
    els.btnAcceptOffer.style.display = 'block';
    els.btnAcceptOffer.disabled = false;
    els.btnAcceptOffer.innerHTML = 'Accept & Generate Reply';
    els.guestOfferToken.value = '';
    els.guestAnswerToken.value = '';
    els.guestReplySection.classList.add('hidden');
}

function disconnectP2P() {
    if (dataChannel) dataChannel.close();
    if (peerConnection) peerConnection.close();
    onDisconnected();
    logSys('Manually disconnected from peer.', 'info');
}

function startLatencyPing() {
    pingInterval = setInterval(() => {
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify({ type: 'ping', time: Date.now() }));
        }
    }, 2000);
}

function setupClipboardButtons() {
    els.btnCopyOffer.addEventListener('click', () => {
        navigator.clipboard.writeText(els.hostOfferToken.value);
        els.btnCopyOffer.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => els.btnCopyOffer.innerHTML = '<i class="fas fa-copy"></i> Copy & Send to Friend', 2000);
    });

    els.btnCopyAnswer.addEventListener('click', () => {
        navigator.clipboard.writeText(els.guestAnswerToken.value);
        els.btnCopyAnswer.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => els.btnCopyAnswer.innerHTML = '<i class="fas fa-copy"></i> Copy & Send to Host', 2000);
    });
}
