import Store from 'electron-store'

const store = new Store({ name: 'wp-fotokopilot-settings' })

const DEFAULT_SETTINGS = {
  maxAltLength: 125,
  concurrency: 3,
  exportFormat: 'csv',
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
}
