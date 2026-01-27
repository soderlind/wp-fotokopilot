import Store from 'electron-store'
import { setCliServerUrl } from './copilot-adapter.js'

const store = new Store({ name: 'wp-fotokopilot-settings' })

const DEFAULT_SETTINGS = {
  maxAltLength: 125,
  concurrency: 3,
  exportFormat: 'csv',
  copilotServerUrl: '',  // Empty = use default (auto-managed CLI)
  copilotModel: 'gpt-4o',  // Default model for alt text generation
}

export async function getSettings() {
  return {
    ...DEFAULT_SETTINGS,
    ...store.get('settings', {}),
  }
}

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
 * Initialize settings on app startup
 * This syncs stored settings with services that need them
 */
export async function initSettings() {
  const settings = await getSettings()
  if (settings.copilotServerUrl) {
    setCliServerUrl(settings.copilotServerUrl)
  }
}
