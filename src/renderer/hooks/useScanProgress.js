/**
 * @fileoverview Hook for subscribing to media scan progress events.
 * Adds scanned media items to the app store as they arrive.
 * @module renderer/hooks/useScanProgress
 */

import { useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useElectronAPI } from './useElectronAPI'

/**
 * Subscribes to scan item events and adds them to the store.
 * Should be called in components that need real-time scan updates.
 * @returns {void}
 */
export function useScanProgress() {
  const api = useElectronAPI()
  const addMediaItem = useAppStore((state) => state.addMediaItem)

  useEffect(() => {
    const unsubscribeItem = api.scan.onItem((item) => {
      addMediaItem(item)
    })

    return () => {
      unsubscribeItem()
    }
  }, [api, addMediaItem])
}
