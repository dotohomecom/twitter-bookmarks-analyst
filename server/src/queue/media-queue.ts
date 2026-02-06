// Media download queue using BullMQ
import { Queue, Worker, Job } from 'bullmq'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { downloadMedia } from '../services/media-downloader.js'
import { updateBookmarkStatus, updateBookmarkMediaPaths } from '../db/bookmarks.js'

export interface MediaDownloadJob {
  bookmarkId: number
  tweetId: string
  tweetUrl: string
  mediaUrls: string[]
  mediaType: 'none' | 'image' | 'video' | 'gif' | 'mixed'
}

let mediaQueue: Queue<MediaDownloadJob> | null = null
let mediaWorker: Worker<MediaDownloadJob> | null = null

export async function initMediaQueue(): Promise<void> {
  try {
    // Create queue
    mediaQueue = new Queue<MediaDownloadJob>('media-download', {
      connection: config.redis,
      defaultJobOptions: {
        attempts: config.download.maxRetries,
        backoff: {
          type: 'exponential',
          delay: config.download.retryDelay,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    })

    // Create worker
    mediaWorker = new Worker<MediaDownloadJob>(
      'media-download',
      async (job: Job<MediaDownloadJob>) => {
        return await processMediaDownload(job)
      },
      {
        connection: config.redis,
        concurrency: config.download.maxConcurrent,
      }
    )

    // Worker event handlers
    mediaWorker.on('completed', (job) => {
      logger.info({ jobId: job.id, tweetId: job.data.tweetId }, 'Media download completed')
    })

    mediaWorker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, error: err.message }, 'Media download failed')
      if (job) {
        updateBookmarkStatus(job.data.bookmarkId, 'failed')
      }
    })

    logger.info('Media queue initialized with Redis')
  } catch (error) {
    // Redis not available, use in-memory fallback
    logger.warn('Redis not available, using in-memory queue fallback')
    initInMemoryQueue()
  }
}

// In-memory queue fallback when Redis is not available
const inMemoryQueue: MediaDownloadJob[] = []
let isProcessing = false

function initInMemoryQueue(): void {
  logger.info('In-memory queue initialized')
  
  // Process queue periodically
  setInterval(async () => {
    if (isProcessing || inMemoryQueue.length === 0) return
    
    isProcessing = true
    const job = inMemoryQueue.shift()
    
    if (job) {
      try {
        await processMediaDownloadDirect(job)
        logger.info({ tweetId: job.tweetId }, 'Media download completed (in-memory)')
      } catch (error) {
        logger.error({ tweetId: job.tweetId, error }, 'Media download failed (in-memory)')
        updateBookmarkStatus(job.bookmarkId, 'failed')
      }
    }
    
    isProcessing = false
  }, 1000)
}

export async function addMediaDownloadJob(job: MediaDownloadJob): Promise<void> {
  if (mediaQueue) {
    await mediaQueue.add('download', job, {
      jobId: `media-${job.tweetId}`,
    })
  } else {
    // Fallback to in-memory queue
    inMemoryQueue.push(job)
    logger.info({ tweetId: job.tweetId, queueSize: inMemoryQueue.length }, 'Added to in-memory queue')
  }
}

async function processMediaDownload(job: Job<MediaDownloadJob>): Promise<string[]> {
  const { bookmarkId, tweetId, tweetUrl, mediaUrls, mediaType } = job.data
  
  logger.info({ tweetId, mediaType, urlCount: mediaUrls.length }, 'Processing media download')
  
  // Update status to downloading
  updateBookmarkStatus(bookmarkId, 'downloading')
  
  try {
    const downloadedPaths = await downloadMedia({
      bookmarkId,
      tweetId,
      tweetUrl,
      mediaUrls,
      mediaType,
    })
    
    // Update bookmark with downloaded paths
    updateBookmarkMediaPaths(bookmarkId, downloadedPaths)
    
    return downloadedPaths
  } catch (error) {
    logger.error({ tweetId, error }, 'Download failed')
    throw error
  }
}

async function processMediaDownloadDirect(job: MediaDownloadJob): Promise<void> {
  const { bookmarkId, tweetId, tweetUrl, mediaUrls, mediaType } = job
  
  logger.info({ tweetId, mediaType, urlCount: mediaUrls.length }, 'Processing media download (direct)')
  
  updateBookmarkStatus(bookmarkId, 'downloading')
  
  const downloadedPaths = await downloadMedia({
    bookmarkId,
    tweetId,
    tweetUrl,
    mediaUrls,
    mediaType,
  })
  
  updateBookmarkMediaPaths(bookmarkId, downloadedPaths)
}

export async function closeMediaQueue(): Promise<void> {
  if (mediaWorker) {
    await mediaWorker.close()
  }
  if (mediaQueue) {
    await mediaQueue.close()
  }
}
