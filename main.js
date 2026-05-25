const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');
const log = require('electron-log');

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

let mainWindow;
let psiphonProcess = null;
let isConnected = false;

const TUNNEL_CORE_VERSION = 'latest';
const TUNNEL_CORE_URL = `https://github.com/Psiphon-Labs/psiphon-tunnel-core/releases/download/${TUNNEL_CORE_VERSION}/psiphon-tunnel-core-windows-x64.exe`;

// Alternative: Build from source if release not available
const TUNNEL_CORE_REPO = 'https://github.com/Psiphon-Labs/psiphon-tunnel-core.git';
const BUILD_SCRIPT = `
cd tunnel-core/ConsoleClient
GOOS=windows GOARCH=amd64 go build -ldflags "-s -w" -o bin/windows/x86_64/psiphon-tunnel-core.exe .
`;

function getTunnelCorePath() {
    const baseDir = app.isPackaged ? process.resourcesPath : path.join(__dirname, 'bin');
    const tunnelDir = path.join(baseDir, 'tunnel-core');
    const exePath = path.join(tunnelDir, 'psiphon-tunnel-core.exe');
    
    // If exe exists, return it
    if (fs.existsSync(exePath)) {
        return exePath;
    }
    
    // Create bin/tunnel-core directory
    if (!fs.existsSync(tunnelDir)) {
        fs.mkdirSync(tunnelDir, { recursive: true });
    }
    
    return exePath;
}

async function downloadTunnelCore() {
    const exePath = getTunnelCorePath();
    
    if (fs.existsSync(exePath)) {
        log.info('Tunnel core already exists');
        return exePath;
    }
    
    log.info(`Downloading tunnel core from ${TUNNEL_CORE_URL}...`);
    
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(exePath);
        https.get(TUNNEL_CORE_URL, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                const redirectUrl = response.headers.location;
                log.info(`Following redirect to ${redirectUrl}`);
                https.get(redirectUrl, (redirectResponse) => {
                    redirectResponse.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        log.info('Tunnel core downloaded successfully');
                        resolve(exePath);
                    });
                }).on('error', reject);
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    log.info('Tunnel core downloaded successfully');
                    resolve(exePath);
                });
            }
        }).on('error', (err) => {
            fs.unlink(exePath, () => {});
            reject(err);
        });
    });
}

function getConfigPath() {
    const configDir = path.join(app.getPath('userData'), 'config');
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    return path.join(configDir, 'config.json');
}

function createConfig(settings) {
    const config = {
        TunnelPoolSize: 6,
        RemoteServerListURLs: [
            "https:// psiphon-labs.herokuapp.com / tunnel / linux / American",
            "https:// psiphon-labs-v2.herokuapp.com / tunnel / linux / American",
            "https:// psiphon-labs-2.herokuapp.com / tunnel / linux / American",
            "https:// psiphon-labs-3.herokuapp.com / tunnel / linux / American"
        ],
        RemoteServerListSignaturePublicKey: "",
        PropagationChannelId: "",
        SponsorId: "",
        
        // Local proxy ports
        LocalSocksProxyPort: 0,
        LocalHttpProxyPort: 0,
        
        // Upstream proxy (if configured)
        UpstreamProxyUrl: "",
        
        // Protocol selection
        LimitTunnelProtocols: [],
        InitialLimitTunnelProtocols: [],
        InitialLimitTunnelProtocolsCandidateCount: 0
    };

    // Apply protocol settings
    switch (settings.protocolMode) {
        case 'auto':
            // All protocols allowed
            config.LimitTunnelProtocols = [];
            config.InitialLimitTunnelProtocols = [];
            config.InitialLimitTunnelProtocolsCandidateCount = 0;
            break;
            
        case 'direct':
            config.LimitTunnelProtocols = ['SSH', 'OBFUSCATED_SSH'];
            config.InitialLimitTunnelProtocols = ['SSH'];
            config.InitialLimitTunnelProtocolsCandidateCount = 10;
            break;
            
        case 'cdn_fronting':
            config.LimitTunnelProtocols = [
                'FRONTED_MEEK', 
                'FRONTED_MEEK_HTTP', 
                'FRONTED_MEEK_QUIC_OBFUSCATED_SSH'
            ];
            config.InitialLimitTunnelProtocols = ['FRONTED_MEEK'];
            config.InitialLimitTunnelProtocolsCandidateCount = 10;
            
            // Custom CDN fronting settings
            if (settings.cdnFrontingCustomIpList) {
                config.FrontedAddresses = settings.cdnFrontingCustomIpList.split('\n').filter(ip => ip.trim());
            }
            if (settings.cdnFrontingCustomSni) {
                config.MeekFrontingSNI = settings.cdnFrontingCustomSni;
            }
            break;
            
        case 'conduit':
            config.LimitTunnelProtocols = ['CONDUIT_OBFUSCATED_SSH'];
            config.InitialLimitTunnelProtocols = ['CONDUIT_OBFUSCATED_SSH'];
            config.InitialLimitTunnelProtocolsCandidateCount = 10;
            
            // Conduit mode selection
            if (settings.conduitMode === 'shirokhorshid') {
                config.CustomTlsSni = 'cdn.discordapp.com';
            } else if (settings.conduitMode === 'public') {
                config.CustomTlsSni = '';
            }
            break;
    }

    // Local proxy settings
    if (settings.localSocksPort) {
        config.LocalSocksProxyPort = parseInt(settings.localSocksPort);
    }
    if (settings.localHttpPort) {
        config.LocalHttpProxyPort = parseInt(settings.localHttpPort);
    }

    // Upstream proxy
    if (settings.upstreamProxy) {
        config.UpstreamProxyUrl = settings.upstreamProxy;
    }

    // Network sharing
    if (settings.exposeProxiesToLan) {
        config.ExposeLocalProxiesToLAN = true;
    }

    // Split tunnel
    if (settings.splitTunnelEnabled) {
        config.SplitTunnel = true;
        if (settings.splitTunnelChineseSites) {
            config.SplitTunnelChineseSites = true;
        }
    }

    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    log.info('Config written to:', configPath);
    
    return configPath;
}

function startPsiphon(settings) {
    return new Promise((resolve, reject) => {
        const configPath = createConfig(settings);
        
        // Check if psiphon is already running
        if (psiphonProcess) {
            stopPsiphon();
        }

        log.info('Starting Psiphon with config:', configPath);
        
        // Get tunnel core path (download if needed)
        const tunnelCorePath = getTunnelCorePath();
        
        // Download if not exists
        if (!fs.existsSync(tunnelCorePath)) {
            try {
                await downloadTunnelCore();
            } catch (err) {
                log.error('Failed to download tunnel core:', err);
                reject(err);
                return;
            }
        }
        
        const args = [
            '-config', configPath,
            '-verbosity', '2'
        ];

        try {
            psiphonProcess = spawn(tunnelCorePath, args, {
                detached: false,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let connected = false;

            psiphonProcess.stdout.on('data', (data) => {
                const output = data.toString();
                log.info('Psiphon stdout:', output);
                
                // Check for connection status
                if (output.includes('tunnel ready') || output.includes('Connected')) {
                    connected = true;
                    isConnected = true;
                    if (mainWindow) {
                        mainWindow.webContents.send('status-update', { connected: true, message: 'Connected' });
                    }
                    resolve(true);
                }
            });

            psiphonProcess.stderr.on('data', (data) => {
                const output = data.toString();
                log.info('Psiphon stderr:', output);
                
                // Parse notices for status
                if (output.includes('Notice:')) {
                    if (output.includes('Connected')) {
                        isConnected = true;
                        if (mainWindow && !connected) {
                            connected = true;
                            mainWindow.webContents.send('status-update', { connected: true, message: 'Connected' });
                            resolve(true);
                        }
                    }
                }
            });

            psiphonProcess.on('error', (error) => {
                log.error('Psiphon process error:', error);
                isConnected = false;
                reject(error);
            });

            psiphonProcess.on('exit', (code) => {
                log.info('Psiphon process exited with code:', code);
                isConnected = false;
                if (mainWindow) {
                    mainWindow.webContents.send('status-update', { connected: false, message: 'Disconnected' });
                }
            });

            // Timeout after 30 seconds if not connected
            setTimeout(() => {
                if (!connected) {
                    log.warn('Connection timeout');
                    // Don't reject, let it keep trying
                }
            }, 30000);

        } catch (error) {
            log.error('Failed to start Psiphon:', error);
            reject(error);
        }
    });
}

function stopPsiphon() {
    if (psiphonProcess) {
        log.info('Stopping Psiphon');
        psiphonProcess.kill();
        psiphonProcess = null;
        isConnected = false;
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'icon.png')
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', () => {
        mainWindow = null;
        stopPsiphon();
    });
}

app.whenReady().then(() => {
    log.info('App starting');
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    stopPsiphon();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC handlers
ipcMain.handle('connect', async (event, settings) => {
    log.info('Connect request with settings:', settings);
    try {
        await startPsiphon(settings);
        return { success: true };
    } catch (error) {
        log.error('Connect error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('disconnect', async () => {
    log.info('Disconnect request');
    stopPsiphon();
    return { success: true };
});

ipcMain.handle('get-status', async () => {
    return { connected: isConnected };
});

ipcMain.handle('get-logs', async () => {
    return log.transports.file.getFile().path;
});