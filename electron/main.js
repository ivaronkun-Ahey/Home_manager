const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { registerIpc } = require('./ipc/registerIpc');
const { ensureDataDirs } = require('./storage/fsPaths');
const NotificationScheduler = require('./services/NotificationScheduler');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0b0f19',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  return win;
}

app.whenReady().then(() => {
  ensureDataDirs();
  registerIpc();
  createWindow();

  // Запуск планировщика уведомлений
  NotificationScheduler.start();

  const template = [
    {
      label: 'App',
      submenu: [
        { label: 'Open data folder', click: async () => {
          const p = ensureDataDirs();
          await shell.openPath(p.dataDir);
        }},
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { label: 'View', submenu: [
      { role: 'reload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' }
    ]}
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  NotificationScheduler.stop();
});
