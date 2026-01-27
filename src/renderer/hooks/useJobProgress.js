import { useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useElectronAPI } from './useElectronAPI'

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
