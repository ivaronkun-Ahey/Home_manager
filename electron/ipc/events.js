const { BrowserWindow } = require('electron');

function emitDataChanged(entity, action) {
  const evt = { entity, action, at: Date.now() };
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('hm:event:dataChanged', evt);
  }
}

module.exports = { emitDataChanged };
