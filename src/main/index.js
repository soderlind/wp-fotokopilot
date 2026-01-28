/**
 * @fileoverview Main process entry point for WP FotoKopilot Electron app.
 * Initializes the main window, registers IPC handlers, and manages app lifecycle.
 * @module main/index
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc/router.js'
import { initSettings } from './services/settings-store.js'

const isDev = !app.isPackaged

/** @type {BrowserWindow|undefined} */
let mainWindow

/**
 * Creates the main application window with appropriate settings
 * for development or production mode.
 * @returns {void}
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'WP FotoKopilot',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(import.meta.dirname, '../../dist/index.html'))
  }

  registerIpcHandlers(mainWindow, ipcMain)
}

app.whenReady().then(async () => {
  // Initialize settings and sync with services
  await initSettings()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

export { mainWindow }
