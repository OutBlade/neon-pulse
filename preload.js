// NEON PULSE — Preload bridge
// Exposes a tiny, safe API to the renderer so it can call window controls.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('neon', {
  toggleFullscreen: () => ipcRenderer.invoke('app:toggle-fullscreen'),
  quit:             () => ipcRenderer.invoke('app:quit'),
  minimize:         () => ipcRenderer.invoke('app:minimize'),
  version:          () => ipcRenderer.invoke('app:version'),
  isElectron:       true,
});
