// Simple in-memory media download queue (no Redis dependency)
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { downloadMedia } from '../services/media-downloader.js'
import { updateBookmarkStatus, updateBookmarkMediaResult } from '../db/bookmarks.js'

export interface MediaDownloadJob {
  bookmarkId: number
  tweetId: string
  tweetUrl: string
  mediaUrls: string[]
  mediaType: 'none' | 'image' | 'video' | 'gif' | 'mixed'
}

// In-memory queue
const queue: MediaDownloadJob[] = []
let isProcessing = false

export async function initMediaQueue(): Promise<void> {
  logger.info('In-memory media queue initialized')

  // Process queue periodically
  setInterval(processQueue, 2000)
}

export async function addMediaDownloadJob(job: MediaDownloadJob): Promise<void> {
  // Avoid duplicates
  if (queue.some((j) => j.tweetId === job.tweetId)) {
    logger.info({ tweetId: job.tweetId }, 'Job already in queue, skipping')
    return
  }

  queue.push(job)
  logger.info({ tweetId: job.tweetId, queueSize: queue.length }, 'Added to download queue')
}

async function processQueue(): Promise<void> {
  if (isProcessing || queue.length === 0) return

  isProcessing = true

  // Process up to maxConcurrent jobs
  const jobs = queue.splice(0, config.download.maxConcurrent)

  await Promise.all(
    jobs.map(async (job) => {
      try {
        await processJob(job)
      } catch (error) {
        logger.error({ tweetId: job.tweetId, error }, 'Download job failed')
        updateBookmarkStatus(job.bookmarkId, 'failed', true)
      }
    }),
  )

  isProcessing = false
}

async function processJob(job: MediaDownloadJob): Promise<void> {
  const { bookmarkId, tweetId, tweetUrl, mediaUrls, mediaType } = job

  logger.info({ tweetId, mediaType, urlCount: mediaUrls.length }, 'Processing download job')

  // Update status to downloading and clear old failure marker
  updateBookmarkStatus(bookmarkId, 'downloading', false)

  try {
    const downloadResult = await downloadMedia({
      bookmarkId,
      tweetId,
      tweetUrl,
      mediaUrls,
      mediaType,
    })

    updateBookmarkMediaResult(bookmarkId, downloadResult.downloadedPaths, downloadResult.hasFailure)

    if (downloadResult.hasFailure) {
      logger.warn(
        {
          tweetId,
          expectedCount: downloadResult.expectedCount,
          downloadedCount: downloadResult.downloadedCount,
          failedCount: downloadResult.failedCount,
        },
        'Download completed with missing media files',
      )
    } else {
      logger.info({ tweetId, downloadedCount: downloadResult.downloadedPaths.length }, 'Download completed')
    }
  } catch (error) {
    logger.error({ tweetId, error }, 'Download failed')
    updateBookmarkStatus(bookmarkId, 'failed', true)
    throw error
  }
}

export function getQueueStatus(): { pending: number; processing: boolean } {
  return {
    pending: queue.length,
    processing: isProcessing,
  }
}
