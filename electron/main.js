const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// Set App User Model ID so Windows shows custom icon in taskbar even in dev mode
if (process.platform === 'win32') {
  app.setAppUserModelId('com.blackboxthc.tasker');
}

function createWindow() {
  const icoPath = path.join(__dirname, 'assets', 'icon.ico');
  const pngPath = path.join(__dirname, 'assets', 'icon.png');
  const iconPath = fs.existsSync(icoPath) ? icoPath : (fs.existsSync(pngPath) ? pngPath : undefined);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1000,
    minHeight: 650,
    title: 'Tasker - Universal AI-Powered Productivity Suite',
    icon: iconPath,
    autoHideMenuBar: true,
    backgroundColor: '#090a0f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // allow local media loading
    }
  });

  if (iconPath) {
    try {
      mainWindow.setIcon(iconPath);
    } catch (e) {
      console.warn('Could not set window icon:', e);
    }
  }

  // Always open external web links (like Google AI Studio) in user's default browser (Chrome/Edge/Firefox)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Enable F5 / Ctrl+R to reload and F12 / Ctrl+Shift+I to toggle DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
      mainWindow.reload();
    }
    if ((input.control && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Load the production built client
  mainWindow.loadFile(path.join(__dirname, '../client/dist/index.html'));
}

// Enable autostart with Windows boot by default
app.whenReady().then(() => {
  try {
    const loginItemSettings = app.getLoginItemSettings();
    if (!loginItemSettings.openAtLogin) {
      app.setLoginItemSettings({
        openAtLogin: true,
        args: ['--autostart']
      });
    }
  } catch (err) {
    console.error('Error configuring autostart:', err);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// IPC Handler to open external URLs in system browser
ipcMain.on('open-external-url', (_event, url) => {
  if (url && (url.startsWith('http:') || url.startsWith('https:'))) {
    shell.openExternal(url);
  }
});

// IPC Handlers for system boot startup toggle
ipcMain.handle('get-autostart', () => {
  try {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  } catch {
    return true;
  }
});

ipcMain.handle('set-autostart', (_event, enable) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: !!enable,
      args: enable ? ['--autostart'] : []
    });
    return true;
  } catch (e) {
    console.error('Failed to set autostart:', e);
    return false;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
