const { contextBridge, ipcRenderer } = require('electron');

function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

const dataChangedHandlers = new Map();

const api = {
  meta: {
    getAppInfo: () => invoke('hm:meta:getAppInfo'),
    openDataFolder: () => invoke('hm:meta:openDataFolder')
  },
  profiles: {
    list: () => invoke('hm:profiles:list'),
    create: (payload) => invoke('hm:profiles:create', payload),
    update: (payload) => invoke('hm:profiles:update', payload),
    archive: (payload) => invoke('hm:profiles:archive', payload),
    delete: (payload) => invoke('hm:profiles:delete', payload)
  },
  tags: {
    list: () => invoke('hm:tags:list'),
    create: (payload) => invoke('hm:tags:create', payload),
    rename: (payload) => invoke('hm:tags:rename', payload),
    delete: (payload) => invoke('hm:tags:delete', payload),
    merge: (payload) => invoke('hm:tags:merge', payload)
  },
  tasks: {
    list: (filter) => invoke('hm:tasks:list', filter),
    create: (payload) => invoke('hm:tasks:create', payload),
    update: (payload) => invoke('hm:tasks:update', payload),
    setStatus: (payload) => invoke('hm:tasks:setStatus', payload),
    reschedule: (payload) => invoke('hm:tasks:reschedule', payload),
    delete: (payload) => invoke('hm:tasks:delete', payload)
  },
  routines: {
    list: (filter) => invoke('hm:routines:list', filter),
    create: (payload) => invoke('hm:routines:create', payload),
    update: (payload) => invoke('hm:routines:update', payload),
    setActive: (payload) => invoke('hm:routines:setActive', payload),
    generate: (payload) => invoke('hm:routines:generate', payload),
    markInstance: (payload) => invoke('hm:routines:markInstance', payload),
    get: (payload) => invoke('hm:routines:get', payload),
    delete: (payload) => invoke('hm:routines:delete', payload)
  },
  assets: {
    list: () => invoke('hm:assets:list'),
    create: (payload) => invoke('hm:assets:create', payload),
    update: (payload) => invoke('hm:assets:update', payload),
    delete: (payload) => invoke('hm:assets:delete', payload),
    get: (payload) => invoke('hm:assets:get', payload)
  },
  maintenance: {
    plans: {
      list: (filter) => invoke('hm:maintenance:plans:list', filter),
      create: (payload) => invoke('hm:maintenance:plans:create', payload),
      update: (payload) => invoke('hm:maintenance:plans:update', payload),
      setActive: (payload) => invoke('hm:maintenance:plans:setActive', payload),
      delete: (payload) => invoke('hm:maintenance:plans:delete', payload)
    },
    logs: {
      list: (filter) => invoke('hm:maintenance:logs:list', filter),
      create: (payload) => invoke('hm:maintenance:logs:create', payload),
      delete: (payload) => invoke('hm:maintenance:logs:delete', payload)
    }
  },
  goals: {
    list: (filter) => invoke('hm:goals:list', filter),
    create: (payload) => invoke('hm:goals:create', payload),
    update: (payload) => invoke('hm:goals:update', payload),
    setStatus: (payload) => invoke('hm:goals:setStatus', payload),
    addContribution: (payload) => invoke('hm:goals:addContribution', payload),
    get: (payload) => invoke('hm:goals:get', payload)
  },
  expenses: {
    list: (filter) => invoke('hm:expenses:list', filter),
    create: (payload) => invoke('hm:expenses:create', payload),
    update: (payload) => invoke('hm:expenses:update', payload),
    delete: (payload) => invoke('hm:expenses:delete', payload)
  },
  documents: {
    list: (filter) => invoke('hm:documents:list', filter),
    pickFile: () => invoke('hm:documents:pickFile'),
    attach: (payload) => invoke('hm:documents:attach', payload),
    open: (payload) => invoke('hm:documents:open', payload),
    relink: (payload) => invoke('hm:documents:relink', payload),
    delete: (payload) => invoke('hm:documents:delete', payload)
  },
  backup: {
    exportPickPath: () => invoke('hm:backup:exportPickPath'),
    exportTo: (payload) => invoke('hm:backup:exportTo', payload),
    importPickFile: () => invoke('hm:backup:importPickFile'),
    importFrom: (payload) => invoke('hm:backup:importFrom', payload)
  },
  search: {
    query: (payload) => invoke('hm:search:query', payload)
  },
  events: {
    onDataChanged: (handler) => {
      if (dataChangedHandlers.has(handler)) {
        ipcRenderer.removeListener('hm:event:dataChanged', dataChangedHandlers.get(handler));
      }
      const wrapped = (_, evt) => handler(evt);
      dataChangedHandlers.set(handler, wrapped);
      ipcRenderer.on('hm:event:dataChanged', wrapped);
      return () => api.events.offDataChanged(handler);
    },
    offDataChanged: (handler) => {
      const wrapped = dataChangedHandlers.get(handler);
      if (wrapped) {
        ipcRenderer.removeListener('hm:event:dataChanged', wrapped);
        dataChangedHandlers.delete(handler);
      }
    }
  },

  // ============================================
  // NEW MODULES FOR v2.0
  // ============================================

  properties: {
    list: () => invoke('hm:properties:list'),
    get: (payload) => invoke('hm:properties:get', payload),
    create: (payload) => invoke('hm:properties:create', payload),
    update: (payload) => invoke('hm:properties:update', payload),
    delete: (payload) => invoke('hm:properties:delete', payload)
  },
  rooms: {
    list: (filter) => invoke('hm:rooms:list', filter),
    get: (payload) => invoke('hm:rooms:get', payload),
    create: (payload) => invoke('hm:rooms:create', payload),
    update: (payload) => invoke('hm:rooms:update', payload),
    delete: (payload) => invoke('hm:rooms:delete', payload)
  },
  inventory: {
    list: (filter) => invoke('hm:inventory:list', filter),
    get: (payload) => invoke('hm:inventory:get', payload),
    create: (payload) => invoke('hm:inventory:create', payload),
    update: (payload) => invoke('hm:inventory:update', payload),
    delete: (payload) => invoke('hm:inventory:delete', payload)
  },
  meters: {
    list: (filter) => invoke('hm:meters:list', filter),
    get: (payload) => invoke('hm:meters:get', payload),
    create: (payload) => invoke('hm:meters:create', payload),
    update: (payload) => invoke('hm:meters:update', payload),
    delete: (payload) => invoke('hm:meters:delete', payload),
    addReading: (payload) => invoke('hm:meters:addReading', payload),
    getReadings: (filter) => invoke('hm:meters:getReadings', filter)
  },
  contacts: {
    list: (filter) => invoke('hm:contacts:list', filter),
    get: (payload) => invoke('hm:contacts:get', payload),
    create: (payload) => invoke('hm:contacts:create', payload),
    update: (payload) => invoke('hm:contacts:update', payload),
    delete: (payload) => invoke('hm:contacts:delete', payload)
  },
  checklists: {
    list: () => invoke('hm:checklists:list'),
    get: (payload) => invoke('hm:checklists:get', payload),
    create: (payload) => invoke('hm:checklists:create', payload),
    update: (payload) => invoke('hm:checklists:update', payload),
    delete: (payload) => invoke('hm:checklists:delete', payload),
    getProgress: (payload) => invoke('hm:checklists:getProgress', payload),
    toggleItem: (payload) => invoke('hm:checklists:toggleItem', payload),
    resetProgress: (payload) => invoke('hm:checklists:resetProgress', payload)
  },
  stats: {
    get: () => invoke('hm:stats:get'),
    update: (payload) => invoke('hm:stats:update', payload)
  },
  notifications: {
    getSettings: () => invoke('hm:notifications:getSettings'),
    updateSettings: (settings) => invoke('hm:notifications:updateSettings', settings),
    test: () => invoke('hm:notifications:test')
  },
  dashboard: {
    getData: () => invoke('hm:dashboard:getData')
  },
  onboarding: {
    getStatus: () => invoke('hm:onboarding:getStatus'),
    getTemplates: () => invoke('hm:onboarding:getTemplates'),
    complete: (data) => invoke('hm:onboarding:complete', data)
  },
  settings: {
    getVisibleModules: () => invoke('hm:settings:getVisibleModules'),
    setModuleVisibility: (module, visible) => invoke('hm:settings:setModuleVisibility', { module, visible }),
    getLanguage: () => invoke('hm:settings:getLanguage'),
    setLanguage: (language) => invoke('hm:settings:setLanguage', { language })
  },
  tariffs: {
    list: () => invoke('hm:tariffs:list'),
    update: (type, price) => invoke('hm:tariffs:update', { type, price })
  },
  customMeterTypes: {
    list: () => invoke('hm:customMeterTypes:list'),
    listAll: () => invoke('hm:customMeterTypes:listAll'),
    get: (payload) => invoke('hm:customMeterTypes:get', payload),
    create: (payload) => invoke('hm:customMeterTypes:create', payload),
    update: (payload) => invoke('hm:customMeterTypes:update', payload),
    archive: (payload) => invoke('hm:customMeterTypes:archive', payload),
    delete: (payload) => invoke('hm:customMeterTypes:delete', payload)
  },
  utility: {
    calculateMonth: (month) => invoke('hm:utility:calculateMonth', month),
    getHistory: (months) => invoke('hm:utility:getHistory', months),
    getStats: (type, months) => invoke('hm:utility:getStats', { type, months })
  },
  analytics: {
    productivity: (days) => invoke('hm:analytics:productivity', days),
    maintenanceCosts: (months) => invoke('hm:analytics:maintenanceCosts', months),
    goals: () => invoke('hm:analytics:goals'),
    summary: () => invoke('hm:analytics:summary')
  },
  telegram: {
    updateSettings: (settings) => invoke('hm:telegram:updateSettings', settings),
    test: () => invoke('hm:telegram:test'),
    sendSummary: () => invoke('hm:telegram:sendSummary')
  }
};

contextBridge.exposeInMainWorld('api', api);
