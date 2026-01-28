/**
 * @fileoverview Local thumbnail cache with LRU eviction.
 * Downloads and caches image thumbnails for Copilot vision analysis.
 * @module main/services/thumbnail-cache
 */

import { createWriteStream } from 'node:fs'
import { mkdir, stat, unlink, readdir } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

/** @type {string} Cache directory path */
const CACHE_DIR = join(tmpdir(), 'wp-fotokopilot-cache')

/** @type {number} Maximum cache size in bytes (500 MB) */
const MAX_CACHE_SIZE = 500 * 1024 * 1024

/** @type {Map<string, number>} LRU tracking: hash -> last access timestamp */
const lruOrder = new Map()

/**
 * Initializes the cache directory.
 * @returns {Promise<void>}
 */
export async function initCache() {
  await mkdir(CACHE_DIR, { recursive: true })
}

/**
 * Gets or downloads a thumbnail to the local cache.
 * @param {Object} mediaItem - WordPress media item
 * @param {string} [mediaItem.thumbnailUrl] - Thumbnail URL
 * @param {string} [mediaItem.sourceUrl] - Full image URL (fallback)
 * @returns {Promise<string>} Local file path to the cached thumbnail
 * @throws {Error} If no image URL available or download fails
 */
export async function getThumbnailPath(mediaItem) {
  await mkdir(CACHE_DIR, { recursive: true })

  const url = mediaItem.thumbnailUrl || mediaItem.sourceUrl
  if (!url) {
    throw new Error('No image URL available')
  }

  const hash = createHash('sha256').update(url).digest('hex').slice(0, 16)
  const ext = extractExtension(url)
  const localPath = join(CACHE_DIR, `${hash}.${ext}`)

  try {
    await stat(localPath)
    lruOrder.set(hash, Date.now())
    return localPath
  } catch {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`)
    }

    await pipeline(response.body, createWriteStream(localPath))
    lruOrder.set(hash, Date.now())
    await evictIfNeeded()

    return localPath
  }
}

/**
 * Extracts file extension from a URL.
 * @private
 * @param {string} url - Image URL
 * @returns {string} File extension (defaults to 'jpg')
 */
function extractExtension(url) {
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\.(\w+)$/)
    return match ? match[1] : 'jpg'
  } catch {
    return 'jpg'
  }
}

/**
 * Evicts least recently used files if cache exceeds size limit.
 * @private
 * @returns {Promise<void>}
 */
async function evictIfNeeded() {
  try {
    const files = await readdir(CACHE_DIR)
    let totalSize = 0

    const fileStats = await Promise.all(
      files.map(async (filename) => {
        try {
          const filepath = join(CACHE_DIR, filename)
          const s = await stat(filepath)
          totalSize += s.size
          return {
            name: filename,
            path: filepath,
            size: s.size,
            hash: filename.split('.')[0],
          }
        } catch {
          return undefined
        }
      })
    )

    const validFiles = fileStats.filter(Boolean)

    if (totalSize <= MAX_CACHE_SIZE) {
      return
    }

    validFiles.sort(
      (a, b) => (lruOrder.get(a.hash) || 0) - (lruOrder.get(b.hash) || 0)
    )

    for (const file of validFiles) {
      try {
        await unlink(file.path)
        lruOrder.delete(file.hash)
        totalSize -= file.size

        if (totalSize <= MAX_CACHE_SIZE * 0.8) {
          break
        }
      } catch {
        continue
      }
    }
  } catch {
    // Ignore cache eviction errors
  }
}

/**
 * Clears all cached thumbnails.
 * @returns {Promise<void>}
 */
export async function clearCache() {
  try {
    const files = await readdir(CACHE_DIR)
    await Promise.all(
      files.map((filename) => unlink(join(CACHE_DIR, filename)).catch(() => {}))
    )
    lruOrder.clear()
  } catch {
    // Ignore errors
  }
}
