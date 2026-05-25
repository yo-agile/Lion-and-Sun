// DOM Elements
const statusText = document.getElementById('status-text');
const connectBtn = document.getElementById('connect-btn');
const protocolMode = document.getElementById('protocol-mode');
const cdnFrontingOptions = document.getElementById('cdn-fronting-options');
const conduitOptions = document.getElementById('conduit-options');
const cdnFrontingIps = document.getElementById('cdn-fronting-ips');
const cdnFrontingSni = document.getElementById('cdn-fronting-sni');
const conduitMode = document.getElementById('conduit-mode');
const socksPort = document.getElementById('socks-port');
const httpPort = document.getElementById('http-port');
const exposeLan = document.getElementById('expose-lan');
const upstreamProxy = document.getElementById('upstream-proxy');
const splitTunnel = document.getElementById('split-tunnel');
const splitTunnelChinese = document.getElementById('split-tunnel-chinese');
const splitTunnelChineseSites = document.getElementById('split-tunnel-chinese-sites');
const logOutput = document.getElementById('log-output');
const clearLogsBtn = document.getElementById('clear-logs');

let isConnected = false;

// Protocol mode change handler
protocolMode.addEventListener('change', (e) => {
    const mode = e.target.value;
    cdnFrontingOptions.style.display = mode === 'cdn_fronting' ? 'block' : 'none';
    conduitOptions.style.display = mode === 'conduit' ? 'block' : 'none';
});

// Split tunnel toggle
splitTunnel.addEventListener('change', (e) => {
    splitTunnelChinese.style.display = e.target.checked ? 'block' : 'none';
});

// Connect/Disconnect button
connectBtn.addEventListener('click', async () => {
    if (isConnected) {
        await disconnect();
    } else {
        await connect();
    }
});

// Clear logs button
clearLogsBtn.addEventListener('click', () => {
    logOutput.textContent = '';
});

function addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    logOutput.textContent += `[${timestamp}] ${message}\n`;
    logOutput.scrollTop = logOutput.scrollHeight;
}

async function connect() {
    addLog('Connecting...');
    connectBtn.disabled = true;
    
    const settings = {
        protocolMode: protocolMode.value,
        cdnFrontingCustomIpList: cdnFrontingIps.value,
        cdnFrontingCustomSni: cdnFrontingSni.value,
        conduitMode: conduitMode.value,
        localSocksPort: socksPort.value || '0',
        localHttpPort: httpPort.value || '0',
        exposeProxiesToLan: exposeLan.checked,
        upstreamProxy: upstreamProxy.value,
        splitTunnelEnabled: splitTunnel.checked,
        splitTunnelChineseSites: splitTunnelChineseSites.checked
    };

    try {
        addLog(`Protocol: ${settings.protocolMode}`);
        if (settings.protocolMode === 'cdn_fronting') {
            addLog(`CDN Fronting IPs: ${settings.cdnFrontingCustomIpList || 'default'}`);
            addLog(`CDN Fronting SNI: ${settings.cdnFrontingCustomSni || 'default'}`);
        }
        if (settings.protocolMode === 'conduit') {
            addLog(`Conduit Mode: ${settings.conduitMode}`);
        }
        
        const result = await window.psiphon.connect(settings);
        
        if (result.success) {
            addLog('Connection initiated');
        } else {
            addLog(`Error: ${result.error}`);
            connectBtn.disabled = false;
        }
    } catch (error) {
        addLog(`Error: ${error.message}`);
        connectBtn.disabled = false;
    }
}

async function disconnect() {
    addLog('Disconnecting...');
    connectBtn.disabled = true;
    
    try {
        await window.psiphon.disconnect();
        addLog('Disconnected');
    } catch (error) {
        addLog(`Error: ${error.message}`);
    }
    
    connectBtn.disabled = false;
}

// Status update listener
window.psiphon.onStatusUpdate((data) => {
    if (data.connected) {
        statusText.textContent = 'Connected';
        statusText.className = 'connected';
        connectBtn.textContent = 'Disconnect';
        connectBtn.disabled = false;
        isConnected = true;
        addLog('Connected to Psiphon');
    } else {
        statusText.textContent = 'Disconnected';
        statusText.className = 'disconnected';
        connectBtn.textContent = 'Connect';
        connectBtn.disabled = false;
        isConnected = false;
        addLog('Disconnected');
    }
});

// Check initial status
async function checkStatus() {
    try {
        const status = await window.psiphon.getStatus();
        if (status.connected) {
            statusText.textContent = 'Connected';
            statusText.className = 'connected';
            connectBtn.textContent = 'Disconnect';
            isConnected = true;
        }
    } catch (error) {
        console.error('Status check error:', error);
    }
}

// Initialize
checkStatus();
addLog('Psiphon Windows initialized');
addLog('Select protocol and click Connect');