import {
  checkCopilotStatus,
  checkCopilotAuth,
  setCliServerUrl,
  getCliServerUrl,
  listModels,
} from '../services/copilot-adapter.js'

export function copilotHandlers(mainWindow) {
  return [
    {
      channel: 'copilot:status',
      async handler() {
        return checkCopilotStatus()
      },
    },
    {
      channel: 'copilot:auth',
      async handler() {
        return checkCopilotAuth()
      },
    },
    {
      channel: 'copilot:setServerUrl',
      async handler(url) {
        setCliServerUrl(url || null)
        return { success: true, url: url || null }
      },
    },
    {
      channel: 'copilot:getServerUrl',
      async handler() {
        return { url: getCliServerUrl() }
      },
    },
    {
      channel: 'copilot:listModels',
      async handler(options) {
        return listModels(options)
      },
    },
  ]
}
