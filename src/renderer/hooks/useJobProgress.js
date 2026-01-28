/**
 * @fileoverview Hook for subscribing to job progress events.
 * Automatically updates the app store when job progress changes.
 * @module renderer/hooks/useJobProgress
 */

import { useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useElectronAPI } from './useElectronAPI'

/**
 * Subscribes to job progress events and returns current job state.
 * Updates the app store with progress data including completed items.
 * @returns {Object|undefined} Current job object or undefined if no job active
 */
export function useJobProgress() {
  const api = useElectronAPI()
  const updateJobProgress = useAppStore((state) => state.updateJobProgress)
  const currentJob = useAppStore((state) => state.currentJob)

  useEffect(() => {
    const unsubscribe = api.job.onProgress((progress) => {
      updateJobProgress(progress)
    })
    return unsubscribe
  }, [api, updateJobProgress])

  return currentJob
}
