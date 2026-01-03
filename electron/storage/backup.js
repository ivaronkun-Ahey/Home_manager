const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { ensureDataDirs } = require('./fsPaths');
const { reloadState } = require('./jsonDb');

function timestamp() {
  const d = new Date();
  const pad = (n)=>String(n).padStart(2,'0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function exportZip(targetPath) {
  const { dataDir } = ensureDataDirs();
  const zip = new AdmZip();
  zip.addLocalFile(path.join(dataDir, 'db.json'), '', 'db.json');
  const attachmentsDir = path.join(dataDir, 'attachments');
  if (fs.existsSync(attachmentsDir)) zip.addLocalFolder(attachmentsDir, 'attachments');
  zip.writeZip(targetPath);
}

async function importZip(sourcePath) {
  const { dataDir, backupsDir } = ensureDataDirs();
  const dbPath = path.join(dataDir, 'db.json');
  const attachmentsDir = path.join(dataDir, 'attachments');

  // auto-backup current
  if (fs.existsSync(dbPath)) {
    const backupZip = new AdmZip();
    backupZip.addLocalFile(dbPath, '', 'db.json');
    if (fs.existsSync(attachmentsDir)) backupZip.addLocalFolder(attachmentsDir, 'attachments');
    backupZip.writeZip(path.join(backupsDir, `auto-backup-before-import_${timestamp()}.zip`));
  }

  const zip = new AdmZip(sourcePath);
  const entries = zip.getEntries().map(e=>e.entryName);
  if (!entries.includes('db.json')) throw new Error('Backup does not contain db.json');

  const tmpDir = path.join(dataDir, '__import_tmp__');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  zip.extractAllTo(tmpDir, true);

  fs.copyFileSync(path.join(tmpDir, 'db.json'), dbPath);

  const tmpAtt = path.join(tmpDir, 'attachments');
  if (fs.existsSync(tmpAtt)) {
    fs.rmSync(attachmentsDir, { recursive: true, force: true });
    fs.mkdirSync(attachmentsDir, { recursive: true });
    copyDir(tmpAtt, attachmentsDir);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });

  // Reload state from disk after import
  reloadState();
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

module.exports = { exportZip, importZip };
