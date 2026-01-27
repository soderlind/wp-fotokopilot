import { siteHandlers } from './site.handlers.js'
import { scanHandlers } from './scan.handlers.js'
import { jobHandlers } from './job.handlers.js'
import { vmfHandlers } from './vmf.handlers.js'
import { settingsHandlers } from './settings.handlers.js'
import { copilotHandlers } from './copilot.handlers.js'

export function registerIpcHandlers(mainWindow, ipcMain) {
  const allHandlers = [
    ...siteHandlers(mainWindow),
    ...scanHandlers(mainWindow),
    ...jobHandlers(mainWindow),
    ...vmfHandlers(mainWindow),
    ...settingsHandlers(mainWindow),
    ...copilotHandlers(mainWindow),
  ]

  for (const { channel, handler } of allHandlers) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!validateSender(event)) {
        throw new Error('Invalid IPC sender')
      }
      return handler(...args)
    })
  }
}

function validateSender(event) {
  const url = event.senderFrame?.url
  if (!url) return false
  return url.startsWith('http://localhost:') || url.startsWith('file://')
}
