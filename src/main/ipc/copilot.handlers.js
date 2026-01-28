/**
 * @fileoverview IPC handlers for GitHub Copilot integration.
 * Provides status checks, authentication, and model management.
 * @module main/ipc/copilot.handlers
 */

import {
  checkCopilotStatus,
  checkCopilotAuth,
  setCliServerUrl,
  getCliServerUrl,
  listModels,
} from '../services/copilot-adapter.js'

/**
 * Creates Copilot-related IPC handlers.
 * @param {Electron.BrowserWindow} mainWindow - The main application window
 * @returns {Array<{channel: string, handler: Function}>} Array of IPC handlers
 */
export function copilotHandlers(mainWindow) {
  return [
    {
      channel: 'copilot:status',
      /** @returns {Promise<{running: boolean, version?: string, error?: string}>} */
      async handler() {
        return checkCopilotStatus()
      },
    },
    {
      channel: 'copilot:auth',
      /** @returns {Promise<{authenticated: boolean, login?: string, error?: string}>} */
      async handler() {
        return checkCopilotAuth()
      },
    },
    {
      channel: 'copilot:setServerUrl',
      /**
       * @param {string|null} url - Custom CLI server URL or null for default
       * @returns {Promise<{success: boolean, url: string|null}>}
       */
      async handler(url) {
        setCliServerUrl(url || null)
        return { success: true, url: url || null }
      },
    },
    {
      channel: 'copilot:getServerUrl',
      /** @returns {Promise<{url: string|null}>} */
      async handler() {
        return { url: getCliServerUrl() }
      },
    },
    {
      channel: 'copilot:listModels',
      /**
       * @param {{visionOnly?: boolean}} options - Filter options
       * @returns {Promise<Array<{id: string, name: string, supportsVision: boolean}>>}
       */
      async handler(options) {
        return listModels(options)
      },
    },
  ]
}
