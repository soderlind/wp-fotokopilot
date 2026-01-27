import { useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useElectronAPI } from './useElectronAPI'

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
