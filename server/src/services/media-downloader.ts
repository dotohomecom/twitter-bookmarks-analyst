// Media downloader service - uses date-based directories from user config
import { mkdir, writeFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { getMediaDir } from './config-store.js'

const RETRY_DELAY_MS = 1000

export interface DownloadRequest {
  bookmarkId: number
  tweetId: string
  tweetUrl: string
  mediaUrls: string[]
  mediaType: 'none' | 'image' | 'video' | 'gif' | 'mixed'
}

export interface DownloadMediaItem {
  mediaKind: 'image' | 'video' | 'gif'
  sourceUrl: string
  sequenceNo: number
  status: 'completed' | 'failed'
  localPath?: string
  errorMessage?: string
  retryCount: number
}

export interface DownloadResult {
  downloadedPaths: string[]
  expectedCount: number
  downloadedCount: number
  failedCount: number
  hasFailure: boolean
  mediaItems: DownloadMediaItem[]
}

interface ImageDownloadAttemptResult {
  success: boolean
  localPath?: string
  errorMessage?: string
  retryCount: number
}

interface YtdlpDownloadResult {
  downloadedPaths: string[]
  retryCount: number
  errorMessage?: string
}

export async function downloadMedia(request: DownloadRequest): Promise<DownloadResult> {
  const { tweetId, tweetUrl, mediaUrls, mediaType } = request
  const downloadedPaths: string[] = []
  const mediaItems: DownloadMediaItem[] = []

  // Get date-based media directory from config (e.g., D:\media\2026-02-06)
  const dateMediaDir = getMediaDir()

  if (!existsSync(dateMediaDir)) {
    await mkdir(dateMediaDir, { recursive: true })
    logger.info({ path: dateMediaDir }, 'Created date-based media directory')
  }

  let expectedCount = 0
  let downloadedCount = 0
  let failedCount = 0
  let sequenceNo = 1

  const imageUrls = mediaUrls.filter((url) => url.includes('twimg.com/media'))
  for (const imageUrl of imageUrls) {
    expectedCount += 1
    const imageResult = await downloadSingleImageWithRetry(imageUrl, dateMediaDir, tweetId, sequenceNo)

    if (imageResult.success && imageResult.localPath) {
      downloadedPaths.push(imageResult.localPath)
      downloadedCount += 1
      mediaItems.push({
        mediaKind: 'image',
        sourceUrl: imageUrl,
        sequenceNo,
        status: 'completed',
        localPath: imageResult.localPath,
        retryCount: imageResult.retryCount,
      })
    } else {
      failedCount += 1
      mediaItems.push({
        mediaKind: 'image',
        sourceUrl: imageUrl,
        sequenceNo,
        status: 'failed',
        errorMessage: imageResult.errorMessage || 'Image download failed',
        retryCount: imageResult.retryCount,
      })
    }

    sequenceNo += 1
  }

  const needsVideoDownload = mediaType === 'video' || mediaType === 'gif' || mediaType === 'mixed'
  if (needsVideoDownload) {
    const videoKind: 'video' | 'gif' = mediaType === 'gif' ? 'gif' : 'video'
    const expectedVideoCount = await detectExpectedVideoCount(tweetUrl)
    expectedCount += expectedVideoCount

    const videoResult = await downloadWithYtdlp(tweetUrl, dateMediaDir, tweetId)
    downloadedPaths.push(...videoResult.downloadedPaths)

    const completedVideoCount = Math.min(videoResult.downloadedPaths.length, expectedVideoCount)
    downloadedCount += completedVideoCount
    failedCount += Math.max(0, expectedVideoCount - completedVideoCount)

    for (let i = 0; i < expectedVideoCount; i++) {
      const localPath = videoResult.downloadedPaths[i]
      mediaItems.push({
        mediaKind: videoKind,
        sourceUrl: tweetUrl + '#video-' + (i + 1),
        sequenceNo,
        status: localPath ? 'completed' : 'failed',
        localPath,
        errorMessage: localPath ? undefined : videoResult.errorMessage || 'Video download failed',
        retryCount: videoResult.retryCount,
      })
      sequenceNo += 1
    }

    // Keep extra downloaded files if extractor returned more than expected
    for (let i = expectedVideoCount; i < videoResult.downloadedPaths.length; i++) {
      mediaItems.push({
        mediaKind: videoKind,
        sourceUrl: tweetUrl + '#video-extra-' + (i + 1),
        sequenceNo,
        status: 'completed',
        localPath: videoResult.downloadedPaths[i],
        retryCount: videoResult.retryCount,
      })
      sequenceNo += 1
    }
  }

  const hasFailure = failedCount > 0

  logger.info(
    {
      tweetId,
      dir: dateMediaDir,
      expectedCount,
      downloadedCount,
      failedCount,
      hasFailure,
      mediaItems: mediaItems.length,
    },
    'Media download completed',
  )

  return {
    downloadedPaths,
    expectedCount,
    downloadedCount,
    failedCount,
    hasFailure,
    mediaItems,
  }
}

async function downloadSingleImageWithRetry(
  url: string,
  destDir: string,
  tweetId: string,
  sequenceNo: number,
): Promise<ImageDownloadAttemptResult> {
  const maxAttempts = config.download.maxRetries + 1
  let lastError = 'Image download failed'

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let ext = '.jpg'
      if (url.includes('.png') || url.includes('format=png')) ext = '.png'
      if (url.includes('.gif')) ext = '.gif'
      if (url.includes('.webp') || url.includes('format=webp')) ext = '.webp'

      const fileName = tweetId + '_img_' + String(sequenceNo).padStart(2, '0') + ext
      const filePath = join(destDir, fileName)

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('HTTP ' + response.status)
      }

      const buffer = await response.arrayBuffer()
      await writeFile(filePath, Buffer.from(buffer))

      logger.debug({ tweetId, filePath, attempt }, 'Image downloaded')
      return {
        success: true,
        localPath: filePath,
        retryCount: attempt - 1,
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown image download error'
      if (attempt < maxAttempts) {
        logger.warn(
          { tweetId, url: url.substring(0, 120), attempt, maxAttempts },
          'Image download failed, retrying in 1 second',
        )
        await wait(RETRY_DELAY_MS)
      } else {
        logger.error(
          { tweetId, url: url.substring(0, 120), error: lastError, maxAttempts },
          'Image download failed after retries',
        )
      }
    }
  }

  return {
    success: false,
    errorMessage: lastError,
    retryCount: config.download.maxRetries,
  }
}

async function detectExpectedVideoCount(tweetUrl: string): Promise<number> {
  try {
    const metadata = await runYtdlpMetadata(tweetUrl)

    if (Array.isArray(metadata?.entries) && metadata.entries.length > 0) {
      return metadata.entries.length
    }

    if (Array.isArray(metadata?.requested_downloads) && metadata.requested_downloads.length > 0) {
      return metadata.requested_downloads.length
    }

    if (metadata?.url || metadata?.ext || metadata?.id) {
      return 1
    }
  } catch (error) {
    logger.warn({ tweetUrl, error }, 'Failed to detect expected video count, falling back to 1')
  }

  return 1
}

async function runYtdlpMetadata(tweetUrl: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-single-json',
      '--skip-download',
      '--no-warnings',
      '--no-progress',
      '--extractor-args',
      'twitter:api=syndication',
      tweetUrl,
    ]

    const proc = spawn(config.ytdlpPath, args, {
      shell: true,
      env: { ...process.env, PATH: process.env.PATH },
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('yt-dlp metadata failed: ' + stderr.substring(0, 300)))
        return
      }

      try {
        resolve(JSON.parse(stdout))
      } catch (error) {
        reject(error)
      }
    })

    proc.on('error', (error) => {
      reject(error)
    })
  })
}

async function downloadWithYtdlp(tweetUrl: string, destDir: string, tweetId: string): Promise<YtdlpDownloadResult> {
  const maxAttempts = config.download.maxRetries + 1
  let lastError = 'yt-dlp download failed'

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await runYtdlpOnce(tweetUrl, destDir, tweetId)

    if (result.downloadedPaths.length > 0) {
      return {
        downloadedPaths: result.downloadedPaths,
        retryCount: attempt - 1,
        errorMessage: result.errorMessage,
      }
    }

    if (result.errorMessage) {
      lastError = result.errorMessage
    }

    if (attempt < maxAttempts) {
      logger.warn(
        { tweetId, attempt, maxAttempts, error: lastError },
        'yt-dlp download failed, retrying in 1 second',
      )
      await wait(RETRY_DELAY_MS)
    } else {
      logger.error({ tweetId, maxAttempts, error: lastError }, 'yt-dlp download failed after retries')
    }
  }

  return {
    downloadedPaths: [],
    retryCount: config.download.maxRetries,
    errorMessage: lastError,
  }
}

async function runYtdlpOnce(
  tweetUrl: string,
  destDir: string,
  tweetId: string,
): Promise<{ downloadedPaths: string[]; errorMessage?: string }> {
  return new Promise((resolve) => {
    const outputTemplate = join(destDir, tweetId + '_video_%(autonumber)02d.%(ext)s')

    const args = [
      tweetUrl,
      '-o',
      outputTemplate,
      '--no-warnings',
      '--no-progress',
      '-f',
      'best[ext=mp4]/best',
      '--remote-components',
      'ejs:npm',
      '--no-check-certificates',
      '--extractor-args',
      'twitter:api=syndication',
    ]

    logger.debug({ cmd: config.ytdlpPath, args: args.slice(0, 6), tweetId }, 'Running yt-dlp')

    const proc = spawn(config.ytdlpPath, args, {
      cwd: destDir,
      shell: true,
      env: { ...process.env, PATH: process.env.PATH },
    })

    let stderr = ''
    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', async (code) => {
      const downloadedPaths = await getDownloadedVideoFiles(destDir, tweetId)

      if (downloadedPaths.length > 0) {
        logger.info({ tweetId, files: downloadedPaths, code }, 'yt-dlp download finished with files')
        resolve({
          downloadedPaths,
          errorMessage: code === 0 ? undefined : 'yt-dlp exited with code ' + code + ': ' + stderr.substring(0, 300),
        })
        return
      }

      resolve({
        downloadedPaths: [],
        errorMessage:
          code === 0
            ? 'yt-dlp finished but no media file was found'
            : 'yt-dlp exited with code ' + code + ': ' + stderr.substring(0, 300),
      })
    })

    proc.on('error', (error) => {
      resolve({
        downloadedPaths: [],
        errorMessage: error instanceof Error ? error.message : 'Failed to spawn yt-dlp',
      })
    })
  })
}

async function getDownloadedVideoFiles(destDir: string, tweetId: string): Promise<string[]> {
  const prefix = tweetId + '_video_'
  const files = await readdir(destDir)

  return files
    .filter((file) => file.startsWith(prefix))
    .sort()
    .map((file) => join(destDir, file))
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
