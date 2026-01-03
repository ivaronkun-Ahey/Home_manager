const { ipcMain, dialog, shell, app } = require('electron');
const path = require('path');
const { ensureDataDirs } = require('../storage/fsPaths');
const { db } = require('../storage/jsonDb');
const { emitDataChanged } = require('./events');
const { exportZip, importZip } = require('../storage/backup');
const { pickFileForAttach, attachFile, openDocument } = require('../storage/documents');
const { searchAll } = require('../storage/search');
const DashboardService = require('../services/DashboardService');
const { TEMPLATES, applyTemplate } = require('../storage/templates');

function ok(data) { return { ok: true, data }; }
function fail(error) { return { ok: false, error: String(error?.message || error) }; }

function registerIpc() {
  // Meta
  ipcMain.handle('hm:meta:getAppInfo', async () => {
    try {
      const { dataDir } = ensureDataDirs();
      return ok({ version: app.getVersion(), platform: process.platform, dataPath: dataDir });
    } catch (e) { return fail(e); }
  });

  ipcMain.handle('hm:meta:openDataFolder', async () => {
    try {
      const { dataDir } = ensureDataDirs();
      await shell.openPath(dataDir);
      return ok(true);
    } catch (e) { return fail(e); }
  });

  // Profiles
  ipcMain.handle('hm:profiles:list', async () => { try { return ok(db.profiles.list()); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:profiles:create', async (_, payload) => { try { const res = db.profiles.create(payload); emitDataChanged('profiles','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:profiles:update', async (_, payload) => { try { const res = db.profiles.update(payload.id, payload.patch); emitDataChanged('profiles','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:profiles:archive', async (_, payload) => { try { const res = db.profiles.archive(payload.id, payload.is_archived); emitDataChanged('profiles','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:profiles:delete', async (_, payload) => { try { const res = db.profiles.delete(payload.id); emitDataChanged('profiles','delete'); return ok(res); } catch (e) { return fail(e); }});

  // Tags
  ipcMain.handle('hm:tags:list', async () => { try { return ok(db.tags.list()); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:tags:create', async (_, payload) => { try { const res = db.tags.create(payload); emitDataChanged('tags','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:tags:rename', async (_, payload) => { try { const res = db.tags.rename(payload.id, payload.name); emitDataChanged('tags','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:tags:delete', async (_, payload) => { try { db.tags.delete(payload.id); emitDataChanged('tags','delete'); return ok(true); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:tags:merge', async (_, payload) => { try { db.tags.merge(payload.from_tag_id, payload.into_tag_id); emitDataChanged('tags','update'); return ok(true); } catch (e) { return fail(e); }});

  // Tasks
  ipcMain.handle('hm:tasks:list', async (_, filter) => { try { return ok(db.tasks.list(filter || {})); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:tasks:create', async (_, payload) => { try { const res = db.tasks.create(payload); emitDataChanged('tasks','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:tasks:update', async (_, payload) => { try { const res = db.tasks.update(payload.id, payload.patch); emitDataChanged('tasks','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:tasks:setStatus', async (_, payload) => { try { const res = db.tasks.setStatus(payload.id, payload.status); emitDataChanged('tasks','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:tasks:reschedule', async (_, payload) => { try { const res = db.tasks.reschedule(payload.id, payload.due_at); emitDataChanged('tasks','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:tasks:delete', async (_, payload) => { try { db.tasks.delete(payload.id); emitDataChanged('tasks','delete'); return ok(true); } catch (e) { return fail(e); }});

  // Routines
  ipcMain.handle('hm:routines:list', async (_, filter) => { try { return ok(db.routines.list(filter || {})); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:routines:get', async (_, payload) => { try { return ok(db.routines.get(payload.id)); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:routines:create', async (_, payload) => { try { const res = db.routines.create(payload); emitDataChanged('routines','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:routines:update', async (_, payload) => { try { const res = db.routines.update(payload.id, payload.patch); emitDataChanged('routines','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:routines:setActive', async (_, payload) => { try { const res = db.routines.setActive(payload.id, payload.is_active); emitDataChanged('routines','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:routines:generate', async (_, payload) => { try { const res = db.routines.generate(payload?.daysAhead || 14); emitDataChanged('tasks','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:routines:markInstance', async (_, payload) => { try { const res = db.routines.markInstance(payload); emitDataChanged('routines','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:routines:delete', async (_, payload) => { try { db.routines.delete(payload.id); emitDataChanged('routines','delete'); return ok(true); } catch (e) { return fail(e); }});

  // Assets
  ipcMain.handle('hm:assets:list', async () => { try { return ok(db.assets.list()); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:assets:get', async (_, payload) => { try { return ok(db.assets.get(payload.id)); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:assets:create', async (_, payload) => { try { const res = db.assets.create(payload); emitDataChanged('assets','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:assets:update', async (_, payload) => { try { const res = db.assets.update(payload.id, payload.patch); emitDataChanged('assets','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:assets:delete', async (_, payload) => { try { db.assets.delete(payload.id); emitDataChanged('assets','delete'); return ok(true); } catch (e) { return fail(e); }});

  // Maintenance
  ipcMain.handle('hm:maintenance:plans:list', async (_, filter) => { try { return ok(db.maintenance.plans.list(filter || {})); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:maintenance:plans:create', async (_, payload) => { try { const res = db.maintenance.plans.create(payload); emitDataChanged('maintenance','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:maintenance:plans:update', async (_, payload) => { try { const res = db.maintenance.plans.update(payload.id, payload.patch); emitDataChanged('maintenance','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:maintenance:plans:setActive', async (_, payload) => { try { const res = db.maintenance.plans.setActive(payload.id, payload.is_active); emitDataChanged('maintenance','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:maintenance:plans:delete', async (_, payload) => { try { db.maintenance.plans.delete(payload.id); emitDataChanged('maintenance','delete'); return ok(true); } catch (e) { return fail(e); }});

  ipcMain.handle('hm:maintenance:logs:list', async (_, filter) => { try { return ok(db.maintenance.logs.list(filter || {})); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:maintenance:logs:create', async (_, payload) => { try { const res = db.maintenance.logs.create(payload); emitDataChanged('maintenance','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:maintenance:logs:delete', async (_, payload) => { try { db.maintenance.logs.delete(payload.id); emitDataChanged('maintenance','delete'); return ok(true); } catch (e) { return fail(e); }});

  // Goals
  ipcMain.handle('hm:goals:list', async (_, filter) => { try { return ok(db.goals.list(filter || {})); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:goals:get', async (_, payload) => { try { return ok(db.goals.get(payload.id)); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:goals:create', async (_, payload) => { try { const res = db.goals.create(payload); emitDataChanged('goals','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:goals:update', async (_, payload) => { try { const res = db.goals.update(payload.id, payload.patch); emitDataChanged('goals','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:goals:setStatus', async (_, payload) => { try { const res = db.goals.setStatus(payload.id, payload.status); emitDataChanged('goals','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:goals:addContribution', async (_, payload) => { try { const res = db.goals.addContribution(payload); emitDataChanged('goals','update'); return ok(res); } catch (e) { return fail(e); }});

  // Expenses
  ipcMain.handle('hm:expenses:list', async (_, filter) => { try { return ok(db.expenses.list(filter || {})); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:expenses:create', async (_, payload) => { try { const res = db.expenses.create(payload); emitDataChanged('expenses','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:expenses:update', async (_, payload) => { try { const res = db.expenses.update(payload.id, payload.patch); emitDataChanged('expenses','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:expenses:delete', async (_, payload) => { try { db.expenses.delete(payload.id); emitDataChanged('expenses','delete'); return ok(true); } catch (e) { return fail(e); }});

  // Documents
  ipcMain.handle('hm:documents:list', async (_, filter) => { try { return ok(db.documents.list(filter || {})); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:documents:pickFile', async () => { try { return ok(await pickFileForAttach()); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:documents:attach', async (_, payload) => { try { const doc = await attachFile(payload); emitDataChanged('documents','create'); return ok(doc); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:documents:open', async (_, payload) => { try { await openDocument(payload.id); return ok(true); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:documents:relink', async (_, payload) => { try { const res = db.documents.relink(payload.id, payload.link); emitDataChanged('documents','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:documents:delete', async (_, payload) => { try { await db.documents.delete(payload.id); emitDataChanged('documents','delete'); return ok(true); } catch (e) { return fail(e); }});

  // Backup
  ipcMain.handle('hm:backup:exportPickPath', async () => {
    try {
      const { dataDir } = ensureDataDirs();
      const res = await dialog.showSaveDialog({
        title: 'Export backup',
        defaultPath: path.join(dataDir, `home-manager-backup-${new Date().toISOString().slice(0,10)}.zip`),
        filters: [{ name: 'Zip', extensions: ['zip'] }]
      });
      if (res.canceled) return ok(null);
      return ok({ targetPath: res.filePath });
    } catch (e) { return fail(e); }
  });

  ipcMain.handle('hm:backup:exportTo', async (_, payload) => { try { await exportZip(payload.targetPath); emitDataChanged('backup','export'); return ok(true); } catch (e) { return fail(e); }});

  ipcMain.handle('hm:backup:importPickFile', async () => {
    try {
      const res = await dialog.showOpenDialog({
        title: 'Import backup',
        properties: ['openFile'],
        filters: [{ name: 'Zip', extensions: ['zip'] }]
      });
      if (res.canceled || !res.filePaths?.length) return ok(null);
      return ok({ sourcePath: res.filePaths[0] });
    } catch (e) { return fail(e); }
  });

  ipcMain.handle('hm:backup:importFrom', async (_, payload) => { try { await importZip(payload.sourcePath); emitDataChanged('backup','import'); return ok(true); } catch (e) { return fail(e); }});

  // Search
  ipcMain.handle('hm:search:query', async (_, payload) => { try { return ok(searchAll(payload.q || '', payload.options || {})); } catch (e) { return fail(e); }});

  // ============================================
  // NEW MODULES FOR v2.0
  // ============================================

  // Properties
  ipcMain.handle('hm:properties:list', async () => { try { return ok(db.properties.list()); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:properties:get', async (_, payload) => { try { return ok(db.properties.get(payload.id)); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:properties:create', async (_, payload) => { try { const res = db.properties.create(payload); emitDataChanged('properties','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:properties:update', async (_, payload) => { try { const res = db.properties.update(payload.id, payload.patch); emitDataChanged('properties','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:properties:delete', async (_, payload) => { try { db.properties.delete(payload.id); emitDataChanged('properties','delete'); return ok(true); } catch (e) { return fail(e); }});

  // Rooms
  ipcMain.handle('hm:rooms:list', async (_, filter) => { try { return ok(db.rooms.list(filter || {})); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:rooms:get', async (_, payload) => { try { return ok(db.rooms.get(payload.id)); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:rooms:create', async (_, payload) => { try { const res = db.rooms.create(payload); emitDataChanged('rooms','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:rooms:update', async (_, payload) => { try { const res = db.rooms.update(payload.id, payload.patch); emitDataChanged('rooms','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:rooms:delete', async (_, payload) => { try { db.rooms.delete(payload.id); emitDataChanged('rooms','delete'); return ok(true); } catch (e) { return fail(e); }});

  // Inventory
  ipcMain.handle('hm:inventory:list', async (_, filter) => { try { return ok(db.inventory.list(filter || {})); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:inventory:get', async (_, payload) => { try { return ok(db.inventory.get(payload.id)); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:inventory:create', async (_, payload) => { try { const res = db.inventory.create(payload); emitDataChanged('inventory','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:inventory:update', async (_, payload) => { try { const res = db.inventory.update(payload.id, payload.patch); emitDataChanged('inventory','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:inventory:delete', async (_, payload) => { try { db.inventory.delete(payload.id); emitDataChanged('inventory','delete'); return ok(true); } catch (e) { return fail(e); }});

  // Meters
  ipcMain.handle('hm:meters:list', async (_, filter) => { try { return ok(db.meters.list(filter || {})); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:meters:get', async (_, payload) => { try { return ok(db.meters.get(payload.id)); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:meters:create', async (_, payload) => { try { const res = db.meters.create(payload); emitDataChanged('meters','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:meters:update', async (_, payload) => { try { const res = db.meters.update(payload.id, payload.patch); emitDataChanged('meters','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:meters:delete', async (_, payload) => { try { db.meters.delete(payload.id); emitDataChanged('meters','delete'); return ok(true); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:meters:addReading', async (_, payload) => { try { const res = db.meters.addReading(payload); emitDataChanged('meters','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:meters:getReadings', async (_, filter) => { try { return ok(db.meters.getReadings(filter || {})); } catch (e) { return fail(e); }});

  // Contacts
  ipcMain.handle('hm:contacts:list', async (_, filter) => { try { return ok(db.contacts.list(filter || {})); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:contacts:get', async (_, payload) => { try { return ok(db.contacts.get(payload.id)); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:contacts:create', async (_, payload) => { try { const res = db.contacts.create(payload); emitDataChanged('contacts','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:contacts:update', async (_, payload) => { try { const res = db.contacts.update(payload.id, payload.patch); emitDataChanged('contacts','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:contacts:delete', async (_, payload) => { try { db.contacts.delete(payload.id); emitDataChanged('contacts','delete'); return ok(true); } catch (e) { return fail(e); }});

  // Checklists
  ipcMain.handle('hm:checklists:list', async () => { try { return ok(db.checklists.list()); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:checklists:get', async (_, payload) => { try { return ok(db.checklists.get(payload.id)); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:checklists:create', async (_, payload) => { try { const res = db.checklists.create(payload); emitDataChanged('checklists','create'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:checklists:update', async (_, payload) => { try { const res = db.checklists.update(payload.id, payload.patch); emitDataChanged('checklists','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:checklists:delete', async (_, payload) => { try { db.checklists.delete(payload.id); emitDataChanged('checklists','delete'); return ok(true); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:checklists:getProgress', async (_, payload) => { try { return ok(db.checklists.getProgress(payload.id)); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:checklists:toggleItem', async (_, payload) => { try { const res = db.checklists.toggleItem(payload.checklistId, payload.itemIndex); emitDataChanged('checklists','update'); return ok(res); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:checklists:resetProgress', async (_, payload) => { try { db.checklists.resetProgress(payload.id); emitDataChanged('checklists','update'); return ok(true); } catch (e) { return fail(e); }});

  // Stats (User Statistics for Gamification)
  ipcMain.handle('hm:stats:get', async () => { try { return ok(db.stats.get()); } catch (e) { return fail(e); }});
  ipcMain.handle('hm:stats:update', async (_, payload) => { try { const res = db.stats.update(payload); emitDataChanged('stats','update'); return ok(res); } catch (e) { return fail(e); }});

  // Notifications
  ipcMain.handle('hm:notifications:getSettings', async () => {
    try {
      const settings = db.stats.getNotificationSettings();
      return ok(settings);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:notifications:updateSettings', async (event, settings) => {
    try {
      const result = db.stats.updateNotificationSettings(settings);

      // Применить настройки к сервису
      const NotificationService = require('../services/NotificationService');
      NotificationService.setEnabled(settings.notifications_enabled ?? true);
      if (settings.notifications_quiet_start !== undefined) {
        NotificationService.setQuietHours(
          settings.notifications_quiet_start,
          settings.notifications_quiet_end
        );
      }

      return ok(result);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:notifications:test', async () => {
    try {
      const NotificationService = require('../services/NotificationService');
      NotificationService.send({
        title: '🔔 Тестовое уведомление',
        body: 'Уведомления работают корректно!',
        type: 'general'
      });
      return ok(true);
    } catch (e) {
      return fail(e);
    }
  });

  // Dashboard
  ipcMain.handle('hm:dashboard:getData', async () => {
    try {
      const data = DashboardService.getData();
      return ok(data);
    } catch (e) {
      return fail(e);
    }
  });

  // Onboarding
  ipcMain.handle('hm:onboarding:getStatus', async () => {
    try {
      const completed = db.stats.isOnboardingCompleted();
      return ok({ completed });
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:onboarding:getTemplates', async () => {
    try {
      const templates = Object.entries(TEMPLATES).map(([key, value]) => ({
        key,
        name: value.name
      }));
      return ok(templates);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:onboarding:complete', async (event, { templateKey, userName, userIcon }) => {
    try {
      // Обновить имя профиля
      const profiles = db.profiles.list({});
      if (profiles.length > 0) {
        const patch = {};
        if (userName) patch.name = userName;
        if (userIcon) patch.icon = userIcon;
        if (Object.keys(patch).length > 0) db.profiles.update(profiles[0].id, patch);
      }

      // Применить шаблон
      if (templateKey) {
        applyTemplate(templateKey, db);
      }

      // Отметить онбординг завершённым
      db.stats.completeOnboarding(templateKey);

      return ok(true);
    } catch (e) {
      return fail(e);
    }
  });

  // ===== SETTINGS =====
  ipcMain.handle('hm:settings:getVisibleModules', async () => {
    try {
      const modules = db.stats.getVisibleModules();
      return ok(modules);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:settings:setModuleVisibility', async (event, { module, visible }) => {
    try {
      const result = db.stats.setModuleVisibility(module, visible);
      return ok(result);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:settings:getLanguage', async () => {
    try {
      const language = db.stats.getLanguage();
      return ok(language);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:settings:setLanguage', async (event, { language }) => {
    try {
      const result = db.stats.setLanguage(language);
      return ok(result);
    } catch (e) {
      return fail(e);
    }
  });

  // ===== TARIFFS =====
  ipcMain.handle('hm:tariffs:list', async () => {
    try {
      const tariffs = db.tariffs.list();
      return ok(tariffs);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:tariffs:update', async (event, { type, price }) => {
    try {
      const tariff = db.tariffs.update(type, price);
      return ok(tariff);
    } catch (e) {
      return fail(e);
    }
  });

  // ===== CUSTOM METER TYPES =====
  ipcMain.handle('hm:customMeterTypes:list', async () => {
    try {
      const types = db.customMeterTypes.list();
      return ok(types);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:customMeterTypes:listAll', async () => {
    try {
      const types = db.customMeterTypes.listAll();
      return ok(types);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:customMeterTypes:get', async (event, { id }) => {
    try {
      const type = db.customMeterTypes.get(id);
      return ok(type);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:customMeterTypes:create', async (event, payload) => {
    try {
      const type = db.customMeterTypes.create(payload);
      emitDataChanged('customMeterTypes', 'create');
      return ok(type);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:customMeterTypes:update', async (event, { id, name, unit }) => {
    try {
      const type = db.customMeterTypes.update(id, { name, unit });
      emitDataChanged('customMeterTypes', 'update');
      return ok(type);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:customMeterTypes:archive', async (event, { id }) => {
    try {
      const type = db.customMeterTypes.archive(id);
      emitDataChanged('customMeterTypes', 'update');
      return ok(type);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:customMeterTypes:delete', async (event, { id }) => {
    try {
      db.customMeterTypes.delete(id);
      emitDataChanged('customMeterTypes', 'delete');
      return ok(true);
    } catch (e) {
      return fail(e);
    }
  });

  // ===== UTILITY CALCULATOR =====
  const UtilityCalculator = require('../services/UtilityCalculator');

  ipcMain.handle('hm:utility:calculateMonth', async (event, month) => {
    try {
      const result = UtilityCalculator.calculateMonthTotal(month);
      return ok(result);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:utility:getHistory', async (event, monthsCount) => {
    try {
      const history = UtilityCalculator.getMonthlyHistory(monthsCount || 12);
      return ok(history);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:utility:getStats', async (event, { type, months }) => {
    try {
      const stats = UtilityCalculator.getConsumptionStats(type, months || 6);
      return ok(stats);
    } catch (e) {
      return fail(e);
    }
  });

  // ===== ANALYTICS =====
  const AnalyticsService = require('../services/AnalyticsService');

  ipcMain.handle('hm:analytics:productivity', async (event, days) => {
    try {
      const data = AnalyticsService.getTasksProductivity(days || 30);
      return ok(data);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:analytics:maintenanceCosts', async (event, months) => {
    try {
      const data = AnalyticsService.getMaintenanceCostsByCategory(months || 6);
      return ok(data);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:analytics:goals', async () => {
    try {
      const data = AnalyticsService.getGoalsAnalytics();
      return ok(data);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:analytics:summary', async () => {
    try {
      const data = AnalyticsService.getSummaryStats();
      return ok(data);
    } catch (e) {
      return fail(e);
    }
  });

  // ===== TELEGRAM =====
  const TelegramService = require('../services/TelegramService');

  ipcMain.handle('hm:telegram:updateSettings', async (event, settings) => {
    try {
      const stats = db.stats.get();
      Object.assign(stats, settings);
      stats.updated_at = new Date().toISOString();
      db.stats.update(stats);
      return ok(true);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:telegram:test', async () => {
    try {
      const result = await TelegramService.testConnection();
      return result;
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle('hm:telegram:sendSummary', async () => {
    try {
      const success = await TelegramService.sendDailySummary();
      return { ok: success };
    } catch (e) {
      return fail(e);
    }
  });
}

module.exports = { registerIpc };
