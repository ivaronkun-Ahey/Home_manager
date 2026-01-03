const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function ensureDataDirs() {
  const base = path.join(app.getPath('userData'), 'data');
  const attachmentsDir = path.join(base, 'attachments');
  const backupsDir = path.join(base, 'backups');
  ensureDir(base);
  ensureDir(attachmentsDir);
  ensureDir(backupsDir);
  return { dataDir: base, attachmentsDir, backupsDir };
}

module.exports = { ensureDataDirs };
