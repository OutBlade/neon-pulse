// NEON PULSE — Preload bridge
// Exposes a safe API to the renderer for window controls and auto-update events.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('neon', {
  toggleFullscreen: () => ipcRenderer.invoke('app:toggle-fullscreen'),
  quit:             () => ipcRenderer.invoke('app:quit'),
  minimize:         () => ipcRenderer.invoke('app:minimize'),
  version:          () => ipcRenderer.invoke('app:version'),
  installUpdate:    () => ipcRenderer.invoke('app:install-update'),
  isElectron:       true,

  // Callbacks for update events sent from main process
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available',  (_e, info) => cb(info)),
  onUpdateReady:     (cb) => ipcRenderer.on('update-downloaded', (_e, info) => cb(info)),
});
