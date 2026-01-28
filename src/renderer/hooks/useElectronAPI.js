/**
 * @fileoverview Hook for accessing the Electron API exposed via preload.
 * @module renderer/hooks/useElectronAPI
 */

/**
 * Returns the Electron API object exposed by the preload script.
 * Provides access to IPC methods for communicating with the main process.
 * @returns {typeof window.electronAPI} Electron API object
 */
export function useElectronAPI() {
  return window.electronAPI
}
