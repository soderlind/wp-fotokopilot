const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  site: {
    add: (config) => ipcRenderer.invoke('site:add', config),
    remove: (id) => ipcRenderer.invoke('site:remove', id),
    list: () => ipcRenderer.invoke('site:list'),
    test: (config) => ipcRenderer.invoke('site:test', config),
    get: (id) => ipcRenderer.invoke('site:get', id),
  },

  plugin: {
    install: (siteId, slug) => ipcRenderer.invoke('plugin:install', { siteId, slug }),
  },

  scan: {
    start: (options) => ipcRenderer.invoke('scan:start', options),
    cancel: () => ipcRenderer.invoke('scan:cancel'),
    onItem: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('scan:item', handler)
      return () => ipcRenderer.removeListener('scan:item', handler)
    },
    onComplete: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('scan:complete', handler)
      return () => ipcRenderer.removeListener('scan:complete', handler)
    },
  },

  job: {
    start: (options) => ipcRenderer.invoke('job:start', options),
    pause: (jobId) => ipcRenderer.invoke('job:pause', jobId),
    resume: (jobId) => ipcRenderer.invoke('job:resume', jobId),
    cancel: (jobId) => ipcRenderer.invoke('job:cancel', jobId),
    get: (jobId) => ipcRenderer.invoke('job:get', jobId),
    export: (options) => ipcRenderer.invoke('job:export', options),
    onProgress: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('job:progress', handler)
      return () => ipcRenderer.removeListener('job:progress', handler)
    },
  },

  vmf: {
    list: (siteId) => ipcRenderer.invoke('vmf:list', { siteId }),
    create: (siteId, name, parentId) =>
      ipcRenderer.invoke('vmf:create', { siteId, name, parentId }),
    createPath: (siteId, path) =>
      ipcRenderer.invoke('vmf:createPath', { siteId, path }),
    assign: (siteId, folderId, mediaIds) =>
      ipcRenderer.invoke('vmf:assign', { siteId, folderId, mediaIds }),
    uncategorized: (siteId, limit) =>
      ipcRenderer.invoke('vmf:uncategorized', { siteId, limit }),
  },

  media: {
    scan: (siteId, options) =>
      ipcRenderer.invoke('media:scan', { siteId, ...options }),
  },

  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings) => ipcRenderer.invoke('settings:set', settings),
  },

  copilot: {
    status: () => ipcRenderer.invoke('copilot:status'),
    auth: () => ipcRenderer.invoke('copilot:auth'),
    setServerUrl: (url) => ipcRenderer.invoke('copilot:setServerUrl', url),
    getServerUrl: () => ipcRenderer.invoke('copilot:getServerUrl'),
    listModels: (options) => ipcRenderer.invoke('copilot:listModels', options),
  },
})
