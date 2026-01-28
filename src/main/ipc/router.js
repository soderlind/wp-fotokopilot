/**
 * @fileoverview IPC router that registers all handler modules with Electron.
 * Provides security validation for IPC senders.
 * @module main/ipc/router
 */

import { siteHandlers } from './site.handlers.js'
import { scanHandlers } from './scan.handlers.js'
import { jobHandlers } from './job.handlers.js'
import { vmfHandlers } from './vmf.handlers.js'
import { settingsHandlers } from './settings.handlers.js'
import { copilotHandlers } from './copilot.handlers.js'

/**
 * Registers all IPC handlers with security validation.
 * @param {Electron.BrowserWindow} mainWindow - The main application window
 * @param {Electron.IpcMain} ipcMain - Electron IPC main process
 * @returns {void}
 */
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

/**
 * Validates that an IPC message originates from a trusted source.
 * @param {Electron.IpcMainInvokeEvent} event - IPC event to validate
 * @returns {boolean} True if sender is trusted
 */
function validateSender(event) {
  const url = event.senderFrame?.url
  if (!url) return false
  return url.startsWith('http://localhost:') || url.startsWith('file://')
}
