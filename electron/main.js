const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1000,
    minHeight: 650,
    title: 'Tasker - Universal AI-Powered Productivity Suite',
    autoHideMenuBar: true,
    backgroundColor: '#090a0f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allow local media loading
    }
  });

  // Load the production built client
  win.loadFile(path.join(__dirname, '../client/dist/index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
