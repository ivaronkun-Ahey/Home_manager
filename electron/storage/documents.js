const { dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { ensureDataDirs } = require('./fsPaths');
const { nanoid } = require('./nanoid');
const { db } = require('./jsonDb');
const { nowISO } = require('./time');

async function pickFileForAttach() {
  const res = await dialog.showOpenDialog({ title: 'Attach file', properties: ['openFile'] });
  if (res.canceled || !res.filePaths?.length) return null;

  const p = res.filePaths[0];
  const stat = await fs.promises.stat(p);
  const fileName = path.basename(p);
  const ext = path.extname(fileName).slice(1).toLowerCase();
  const mimeType = mime.lookup(fileName) || 'application/octet-stream';
  return { tempPath: p, fileName, sizeBytes: stat.size, mime: mimeType, ext };
}

function safeFileName(original) {
  const base = original.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return base.slice(0, 120) || 'file';
}

async function attachFile(payload) {
  if (!payload?.tempPath) throw new Error('No file selected');

  const { attachmentsDir } = ensureDataDirs();
  const src = payload.tempPath;
  const originalName = payload.fileName || path.basename(src);
  const ext = path.extname(originalName);
  const base = safeFileName(path.basename(originalName, ext));
  const id = nanoid();
  const storedName = `${base}__${id}${ext}`;
  const dest = path.join(attachmentsDir, storedName);

  await fs.promises.copyFile(src, dest);
  const stat = await fs.promises.stat(dest);

  const doc = {
    id,
    title: (payload.title || base).trim(),
    file_name: originalName,
    file_ext: ext.slice(1).toLowerCase(),
    mime: mime.lookup(originalName) || 'application/octet-stream',
    size_bytes: stat.size,
    storage_relpath: path.join('attachments', storedName),
    tag_ids: Array.isArray(payload.tag_ids) ? payload.tag_ids : [],
    linked: payload.linked || null,
    created_at: nowISO()
  };

  db.documents.create(doc);
  return doc;
}

async function openDocument(id) {
  const doc = db._raw().documents.find(d => d.id === id);
  if (!doc) throw new Error('Document not found');
  const { dataDir } = ensureDataDirs();
  const p = path.join(dataDir, doc.storage_relpath);
  await shell.openPath(p);
}

module.exports = { pickFileForAttach, attachFile, openDocument };
