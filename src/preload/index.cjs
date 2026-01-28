/**
 * @fileoverview Preload script exposing secure IPC APIs to the renderer process.
 * Uses contextBridge for secure communication between main and renderer.
 * @module preload/index
 */

const { contextBridge, ipcRenderer } = require('electron')

/**
 * Exposed Electron API for renderer process.
 * All methods use IPC invoke for async communication with main process.
 * @namespace electronAPI
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Site management APIs
   * @namespace electronAPI.site
   */
  site: {
    /** @param {Object} config - Site credentials */
    add: (config) => ipcRenderer.invoke('site:add', config),
    /** @param {string} id - Site ID */
    remove: (id) => ipcRenderer.invoke('site:remove', id),
    /** @returns {Promise<Array>} List of sites */
    list: () => ipcRenderer.invoke('site:list'),
    /** @param {Object} config - Site credentials to test */
    test: (config) => ipcRenderer.invoke('site:test', config),
    /** @param {string} id - Site ID */
    get: (id) => ipcRenderer.invoke('site:get', id),
    /** @param {string} id - Site ID to refresh */
    refresh: (id) => ipcRenderer.invoke('site:refresh', id),
  },

  /**
   * Plugin management APIs
   * @namespace electronAPI.plugin
   */
  plugin: {
    /** @param {string} siteId - Site ID, @param {string} slug - Plugin slug */
    install: (siteId, slug) => ipcRenderer.invoke('plugin:install', { siteId, slug }),
  },

  /**
   * Media scanning APIs
   * @namespace electronAPI.scan
   */
  scan: {
    /** @param {Object} options - Scan options */
    start: (options) => ipcRenderer.invoke('scan:start', options),
    cancel: () => ipcRenderer.invoke('scan:cancel'),
    /** @param {Function} callback - Item callback, @returns {Function} Unsubscribe */
    onItem: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('scan:item', handler)
      return () => ipcRenderer.removeListener('scan:item', handler)
    },
    /** @param {Function} callback - Completion callback, @returns {Function} Unsubscribe */
    onComplete: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('scan:complete', handler)
      return () => ipcRenderer.removeListener('scan:complete', handler)
    },
  },

  /**
   * Job queue APIs
   * @namespace electronAPI.job
   */
  job: {
    /** @param {Object} options - Job options */
    start: (options) => ipcRenderer.invoke('job:start', options),
    /** @param {string} jobId - Job ID */
    pause: (jobId) => ipcRenderer.invoke('job:pause', jobId),
    /** @param {string} jobId - Job ID */
    resume: (jobId) => ipcRenderer.invoke('job:resume', jobId),
    /** @param {string} jobId - Job ID */
    cancel: (jobId) => ipcRenderer.invoke('job:cancel', jobId),
    /** @param {string} jobId - Job ID */
    get: (jobId) => ipcRenderer.invoke('job:get', jobId),
    /** @param {Object} options - Export options */
    export: (options) => ipcRenderer.invoke('job:export', options),
    /** @param {Function} callback - Progress callback, @returns {Function} Unsubscribe */
    onProgress: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('job:progress', handler)
      return () => ipcRenderer.removeListener('job:progress', handler)
    },
  },

  /**
   * Virtual Media Folders APIs
   * @namespace electronAPI.vmf
   */
  vmf: {
    /** @param {string} siteId - Site ID */
    list: (siteId) => ipcRenderer.invoke('vmf:list', { siteId }),
    /** @param {string} siteId, @param {string} name, @param {number} [parentId] */
    create: (siteId, name, parentId) =>
      ipcRenderer.invoke('vmf:create', { siteId, name, parentId }),
    /** @param {string} siteId, @param {string} path - Folder path */
    createPath: (siteId, path) =>
      ipcRenderer.invoke('vmf:createPath', { siteId, path }),
    /** @param {string} siteId, @param {number} folderId, @param {number[]} mediaIds */
    assign: (siteId, folderId, mediaIds) =>
      ipcRenderer.invoke('vmf:assign', { siteId, folderId, mediaIds }),
    /** @param {string} siteId, @param {number} [limit] */
    uncategorized: (siteId, limit) =>
      ipcRenderer.invoke('vmf:uncategorized', { siteId, limit }),
  },

  /**
   * Media scanning APIs
   * @namespace electronAPI.media
   */
  media: {
    /** @param {string} siteId, @param {Object} options */
    scan: (siteId, options) =>
      ipcRenderer.invoke('media:scan', { siteId, ...options }),
  },

  /**
   * Settings APIs
   * @namespace electronAPI.settings
   */
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    /** @param {Object} settings - Settings to save */
    set: (settings) => ipcRenderer.invoke('settings:set', settings),
  },

  /**
   * GitHub Copilot APIs
   * @namespace electronAPI.copilot
   */
  copilot: {
    status: () => ipcRenderer.invoke('copilot:status'),
    auth: () => ipcRenderer.invoke('copilot:auth'),
    /** @param {string|null} url - CLI server URL */
    setServerUrl: (url) => ipcRenderer.invoke('copilot:setServerUrl', url),
    getServerUrl: () => ipcRenderer.invoke('copilot:getServerUrl'),
    /** @param {Object} [options] - Filter options */
    listModels: (options) => ipcRenderer.invoke('copilot:listModels', options),
  },
})
