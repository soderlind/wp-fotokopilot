/**
 * @fileoverview Application settings storage and management.
 * Persists user preferences and syncs with dependent services.
 * @module main/services/settings-store
 */

import Store from 'electron-store'
import { setCliServerUrl } from './copilot-adapter.js'

const store = new Store({ name: 'wp-fotokopilot-settings' })

/**
 * @typedef {Object} AppSettings
 * @property {number} maxAltLength - Maximum alt text length (default: 125)
 * @property {number} concurrency - Concurrent job workers (default: 3)
 * @property {string} exportFormat - Export format: 'csv' or 'json'
 * @property {string} copilotServerUrl - Custom Copilot CLI server URL (empty = auto)
 * @property {string} copilotModel - Model ID for alt text generation
 */

/** @type {AppSettings} */
const DEFAULT_SETTINGS = {
  maxAltLength: 125,
  concurrency: 3,
  exportFormat: 'csv',
  copilotServerUrl: '',  // Empty = use default (auto-managed CLI)
  copilotModel: 'gpt-4o',  // Default model for alt text generation
}

/**
 * Gets the current application settings merged with defaults.
 * @returns {Promise<AppSettings>}
 */
export async function getSettings() {
  return {
    ...DEFAULT_SETTINGS,
    ...store.get('settings', {}),
  }
}

/**
 * Saves application settings and syncs with dependent services.
 * @param {Partial<AppSettings>} settings - Settings to update
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  store.set('settings', {
    ...store.get('settings', {}),
    ...settings,
  })
  
  // Sync Copilot server URL with the adapter
  if ('copilotServerUrl' in settings) {
    setCliServerUrl(settings.copilotServerUrl || null)
  }
}

/**
 * Initializes settings on app startup.
 * Syncs stored settings with services that need them.
 * @returns {Promise<void>}
 */
export async function initSettings() {
  const settings = await getSettings()
  if (settings.copilotServerUrl) {
    setCliServerUrl(settings.copilotServerUrl)
  }
}
