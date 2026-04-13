// C:\Digitador\totem\js\preload.js
const { contextBridge, ipcRenderer } = require('electron');

// API expuesta al renderer
contextBridge.exposeInMainWorld('totem', {
    // Abrir ventana de autenticación
    openAuth: () => ipcRenderer.send('app:open-auth'),
    
    // Login
    login: (rut, password) => ipcRenderer.invoke('auth:login', { rut, password }),
    
    // Control de ventana
    close: () => ipcRenderer.send('app:close'),
    minimize: () => ipcRenderer.send('app:minimize'),
    reload: () => ipcRenderer.send('app:reload'),
    
    // Información
    platform: process.platform
});

console.log('[PRELOAD] Cargado correctamente');
