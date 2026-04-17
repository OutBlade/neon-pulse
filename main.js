// NEON PULSE — Electron main process
// Creates the borderless game window, wires up fullscreen controls,
// and manages automatic background updates via electron-updater.

const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow = null;

// ── Auto-updater configuration ────────────────────────────────────────────────
// electron-updater reads the `publish` block in package.json and fetches
// latest.yml from GitHub Releases to detect new versions.
// No token is required for public repositories.
autoUpdater.autoDownload         = true;   // download silently in background
autoUpdater.autoInstallOnAppQuit = true;   // install when user quits normally
autoUpdater.allowPrerelease      = false;  // stable releases only
autoUpdater.channel              = 'latest';

autoUpdater.on('checking-for-update', () => {
  console.log('[updater] Checking for update…');
});

autoUpdater.on('update-available', (info) => {
  console.log('[updater] Update available:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', { version: info.version });
  }
});

autoUpdater.on('update-not-available', () => {
  console.log('[updater] Up to date.');
});

autoUpdater.on('download-progress', (progress) => {
  console.log(`[updater] Downloading… ${Math.round(progress.percent)}%`);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[updater] Update downloaded:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', { version: info.version });
  }
});

autoUpdater.on('error', (err) => {
  // Non-fatal — silently ignore update errors so the game still launches
  console.error('[updater] Error:', err.message);
});

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#05020a',
    show: false,
    autoHideMenuBar: true,
    title: 'Neon Pulse',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Check for updates 5 seconds after launch so startup feels instant
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 5000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('app:toggle-fullscreen', () => {
  if (!mainWindow) return false;
  const isFull = mainWindow.isFullScreen();
  mainWindow.setFullScreen(!isFull);
  return !isFull;
});

ipcMain.handle('app:quit',     () => { app.quit(); });
ipcMain.handle('app:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.handle('app:version',  () => app.getVersion());

// Renderer requests install: quit and let the downloaded installer run
ipcMain.handle('app:install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('F11', () => {
    if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
