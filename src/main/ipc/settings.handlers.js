import { getSettings, saveSettings } from '../services/settings-store.js'

export function settingsHandlers(mainWindow) {
  return [
    {
      channel: 'settings:get',
      async handler() {
        return getSettings()
      },
    },
    {
      channel: 'settings:set',
      async handler(settings) {
        await saveSettings(settings)
        return { success: true }
      },
    },
  ]
}
