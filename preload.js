const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('psiphon', {
    connect: (settings) => ipcRenderer.invoke('connect', settings),
    disconnect: () => ipcRenderer.invoke('disconnect'),
    getStatus: () => ipcRenderer.invoke('get-status'),
    getLogs: () => ipcRenderer.invoke('get-logs'),
    onStatusUpdate: (callback) => {
        ipcRenderer.on('status-update', (event, data) => callback(data));
    }
});