import { create } from 'zustand'

export const useAppStore = create((set, get) => ({
  activeSiteId: undefined,
  sites: [],
  mediaItems: [],
  selectedItems: [],
  folders: [],
  currentJob: undefined,
  settings: {
    maxAltLength: 125,
    exportFormat: 'csv',
    concurrency: 3,
  },

  setActiveSite: (siteId) => set({ activeSiteId: siteId }),
  
  setSites: (sites) => set({ sites }),
  
  addSite: (site) => set((state) => ({ sites: [...state.sites, site] })),
  
  removeSite: (siteId) =>
    set((state) => ({
      sites: state.sites.filter((s) => s.id !== siteId),
      activeSiteId: state.activeSiteId === siteId ? undefined : state.activeSiteId,
    })),

  setMediaItems: (items) => set({ mediaItems: items }),
  
  addMediaItem: (item) =>
    set((state) => ({ mediaItems: [...state.mediaItems, item] })),
  
  updateMediaItem: (id, updates) =>
    set((state) => ({
      mediaItems: state.mediaItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),
  
  clearMediaItems: () => set({ mediaItems: [], selectedItems: [] }),

  toggleSelectItem: (id) =>
    set((state) => ({
      selectedItems: state.selectedItems.includes(id)
        ? state.selectedItems.filter((i) => i !== id)
        : [...state.selectedItems, id],
    })),
  
  selectAllItems: () =>
    set((state) => ({ selectedItems: state.mediaItems.map((i) => i.id) })),
  
  clearSelection: () => set({ selectedItems: [] }),

  setFolders: (folders) => set({ folders }),
  
  addFolder: (folder) =>
    set((state) => ({ folders: [...state.folders, folder] })),

  setCurrentJob: (job) => set({ currentJob: job }),
  
  updateJobProgress: (progress) =>
    set((state) => {
      // Update currentJob with progress
      const newCurrentJob = state.currentJob
        ? { ...state.currentJob, ...progress }
        : undefined

      // Update mediaItems with proposedAlt from completed job items
      let newMediaItems = state.mediaItems
      if (progress.items && progress.items.length > 0) {
        newMediaItems = state.mediaItems.map((mediaItem) => {
          const jobItem = progress.items.find((ji) => ji.id === mediaItem.id)
          if (jobItem && jobItem.proposedAlt) {
            return { ...mediaItem, proposedAlt: jobItem.proposedAlt }
          }
          return mediaItem
        })
      }

      return {
        currentJob: newCurrentJob,
        mediaItems: newMediaItems,
      }
    }),

  setSettings: (settings) =>
    set((state) => ({ settings: { ...state.settings, ...settings } })),
}))
