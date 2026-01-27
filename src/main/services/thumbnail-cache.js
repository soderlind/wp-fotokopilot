import { createWriteStream } from 'node:fs'
import { mkdir, stat, unlink, readdir } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const CACHE_DIR = join(tmpdir(), 'wp-fotokopilot-cache')
const MAX_CACHE_SIZE = 500 * 1024 * 1024
const lruOrder = new Map()

export async function initCache() {
  await mkdir(CACHE_DIR, { recursive: true })
}

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

function extractExtension(url) {
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\.(\w+)$/)
    return match ? match[1] : 'jpg'
  } catch {
    return 'jpg'
  }
}

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
