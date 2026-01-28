/**
 * @fileoverview Global application state management using Zustand.
 * Provides centralized state for sites, media, jobs, and settings.
 * @module renderer/stores/appStore
 */

import { create } from 'zustand'

/**
 * @typedef {Object} MediaItem
 * @property {number} id - WordPress media ID
 * @property {string} filename - Original filename
 * @property {string} sourceUrl - Full image URL
 * @property {string} [thumbnailUrl] - Thumbnail URL
 * @property {string} [currentAlt] - Current alt text
 * @property {string} [proposedAlt] - AI-generated alt text
 * @property {Object} [suggestedFolder] - AI-suggested folder assignment
 */

/**
 * @typedef {Object} AppState
 * @property {string|undefined} activeSiteId - Currently selected site ID
 * @property {Array} sites - List of connected WordPress sites
 * @property {MediaItem[]} mediaItems - Media items from current scan
 * @property {number[]} selectedItems - IDs of selected media items
 * @property {Array} folders - VMF folder structure
 * @property {Object|undefined} currentJob - Active job object
 * @property {Object} settings - Application settings
 */

/**
 * Main application store using Zustand.
 * @type {import('zustand').UseBoundStore<import('zustand').StoreApi<AppState>>}
 */
export const useAppStore = create((set, get) => ({
  /** @type {string|undefined} */
  activeSiteId: undefined,
  /** @type {Array} */
  sites: [],
  /** @type {MediaItem[]} */
  mediaItems: [],
  /** @type {number[]} */
  selectedItems: [],
  /** @type {Array} */
  folders: [],
  /** @type {Object|undefined} */
  currentJob: undefined,
  /** @type {Object} */
  settings: {
    maxAltLength: 125,
    exportFormat: 'csv',
    concurrency: 3,
  },

  /**
   * Sets the active site ID.
   * @param {string|undefined} siteId
   */
  setActiveSite: (siteId) => set({ activeSiteId: siteId }),
  
  /**
   * Replaces all sites.
   * @param {Array} sites
   */
  setSites: (sites) => set({ sites }),
  
  /**
   * Adds a new site.
   * @param {Object} site
   */
  addSite: (site) => set((state) => ({ sites: [...state.sites, site] })),
  
  /**
   * Removes a site by ID.
   * @param {string} siteId
   */
  removeSite: (siteId) =>
    set((state) => ({
      sites: state.sites.filter((s) => s.id !== siteId),
      activeSiteId: state.activeSiteId === siteId ? undefined : state.activeSiteId,
    })),

  /**
   * Replaces all media items.
   * @param {MediaItem[]} items
   */
  setMediaItems: (items) => set({ mediaItems: items }),
  
  /**
   * Adds a single media item.
   * @param {MediaItem} item
   */
  addMediaItem: (item) =>
    set((state) => ({ mediaItems: [...state.mediaItems, item] })),
  
  /**
   * Updates a media item by ID.
   * @param {number} id
   * @param {Partial<MediaItem>} updates
   */
  updateMediaItem: (id, updates) =>
    set((state) => ({
      mediaItems: state.mediaItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),
  
  /** Clears all media items and selection. */
  clearMediaItems: () => set({ mediaItems: [], selectedItems: [] }),

  /**
   * Toggles selection of a media item.
   * @param {number} id
   */
  toggleSelectItem: (id) =>
    set((state) => ({
      selectedItems: state.selectedItems.includes(id)
        ? state.selectedItems.filter((i) => i !== id)
        : [...state.selectedItems, id],
    })),
  
  /** Selects all media items. */
  selectAllItems: () =>
    set((state) => ({ selectedItems: state.mediaItems.map((i) => i.id) })),
  
  /** Clears selection. */
  clearSelection: () => set({ selectedItems: [] }),

  /**
   * Replaces all folders.
   * @param {Array} folders
   */
  setFolders: (folders) => set({ folders }),
  
  /**
   * Adds a single folder.
   * @param {Object} folder
   */
  addFolder: (folder) =>
    set((state) => ({ folders: [...state.folders, folder] })),

  /**
   * Sets the current job.
   * @param {Object|undefined} job
   */
  setCurrentJob: (job) => set({ currentJob: job }),
  
  /**
   * Updates job progress and syncs proposedAlt to media items.
   * @param {Object} progress - Job progress data
   */
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

  /**
   * Merges new settings with existing.
   * @param {Partial<Object>} settings
   */
  setSettings: (settings) =>
    set((state) => ({ settings: { ...state.settings, ...settings } })),
}))
