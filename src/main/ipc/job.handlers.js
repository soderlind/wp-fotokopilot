import { JobQueue } from '../services/job-queue.js'
import { getThumbnailPath } from '../services/thumbnail-cache.js'
import { generateAltText, generateAltTextWithFolder, clearSessionSuggestedFolders } from '../services/copilot-adapter.js'
import { createWpClient } from '../services/wp-client.js'
import { getCredentials } from '../services/credential-store.js'
import { getSettings } from '../services/settings-store.js'

const jobQueue = new JobQueue({ concurrency: 3, maxRetries: 3 })

export function jobHandlers(mainWindow) {
  jobQueue.on('job:progress', (data) => {
    mainWindow.webContents.send('job:progress', data)
  })

  return [
    {
      channel: 'job:start',
      async handler({ type, siteId, items, options = {} }) {
        const jobId = crypto.randomUUID()
        const credentials = await getCredentials(siteId)
        const settings = await getSettings()
        const wpClient = createWpClient(credentials)

        // Fetch site language for prompts
        let languageName = 'English'
        try {
          const locale = await wpClient.getSiteLocale()
          languageName = wpClient.getLanguageName(locale)
        } catch {
          // Fallback to English if locale fetch fails
        }

        // Clear session-suggested folders for new job
        if (options.withFolders) {
          clearSessionSuggestedFolders()
        }

        const handler = async (item) => {
          if (type === 'generate') {
            try {
              console.log(`[Job] Processing item ${item.id}: ${item.filename || item.sourceUrl}`)
              const imagePath = await getThumbnailPath(item)
              console.log(`[Job] Downloaded to: ${imagePath}`)
              
              if (options.withFolders && options.existingFolders) {
                // Use folder suggestion mode
                const result = await generateAltTextWithFolder(imagePath, options.existingFolders, {
                  maxLength: settings.maxAltLength || 125,
                  languageName,
                  metadata: {
                    filename: item.filename,
                    title: item.title,
                    alt: item.currentAlt,
                    caption: item.caption,
                  },
                })
                console.log(`[Job] Result for ${item.id}:`, result.altText || result.error)
                return result
              }
              
              const result = await generateAltText(imagePath, {
                maxLength: settings.maxAltLength || 125,
              })
              console.log(`[Job] Result for ${item.id}:`, result.altText || result.error)
              return result
            } catch (err) {
              console.error(`[Job] Error processing ${item.id}:`, err.message)
              throw err
            }
          }
          if (type === 'apply') {
            await wpClient.updateAltText(item.id, item.proposedAlt)
            return { applied: true }
          }
          throw new Error(`Unknown job type: ${type}`)
        }

        const job = jobQueue.createJob(jobId, items, handler)
        jobQueue.start(jobId)
        return { jobId }
      },
    },
    {
      channel: 'job:pause',
      async handler(jobId) {
        jobQueue.pause(jobId)
        return { paused: true }
      },
    },
    {
      channel: 'job:resume',
      async handler(jobId) {
        jobQueue.resume(jobId)
        return { resumed: true }
      },
    },
    {
      channel: 'job:cancel',
      async handler(jobId) {
        jobQueue.cancel(jobId)
        return { cancelled: true }
      },
    },
    {
      channel: 'job:get',
      async handler(jobId) {
        return jobQueue.getJob(jobId)
      },
    },
    {
      channel: 'job:export',
      async handler({ jobId, format }) {
        const job = jobQueue.getJob(jobId)
        if (!job) throw new Error('Job not found')

        const changes = job.items.map((i) => ({
          id: i.id,
          filename: i.filename,
          oldAlt: i.currentAlt,
          newAlt: i.result?.altText,
          status: i.status,
          error: i.error,
        }))

        if (format === 'json') {
          return JSON.stringify(changes, undefined, 2)
        }

        const header = 'id,filename,old_alt,new_alt,status,error'
        const rows = changes.map((c) =>
          [c.id, c.filename, c.oldAlt, c.newAlt, c.status, c.error || '']
            .map(escapeCSV)
            .join(',')
        )
        return [header, ...rows].join('\n')
      },
    },
  ]
}

function escapeCSV(value) {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
