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

export interface DownloadResult {
  downloadedPaths: string[]
  expectedCount: number
  downloadedCount: number
  failedCount: number
  hasFailure: boolean
}

export async function downloadMedia(request: DownloadRequest): Promise<DownloadResult> {
  const { tweetId, tweetUrl, mediaUrls, mediaType } = request
  const downloadedPaths: string[] = []

  // Get date-based media directory from config (e.g., D:\media\2026-02-06)
  const dateMediaDir = getMediaDir()

  if (!existsSync(dateMediaDir)) {
    await mkdir(dateMediaDir, { recursive: true })
    logger.info({ path: dateMediaDir }, 'Created date-based media directory')
  }

  let expectedCount = 0
  let downloadedCount = 0
  let failedCount = 0

  const imageUrls = mediaUrls.filter((url) => url.includes('twimg.com'))
  if (imageUrls.length > 0) {
    expectedCount += imageUrls.length
    const imageResult = await downloadImages(imageUrls, dateMediaDir, tweetId)
    downloadedPaths.push(...imageResult.downloadedPaths)
    downloadedCount += imageResult.downloadedCount
    failedCount += imageResult.failedCount
  }

  const needsVideoDownload = mediaType === 'video' || mediaType === 'gif' || mediaType === 'mixed'
  if (needsVideoDownload) {
    expectedCount += 1
    const videoPaths = await downloadWithYtdlp(tweetUrl, dateMediaDir, tweetId)

    if (videoPaths.length > 0) {
      downloadedPaths.push(...videoPaths)
      downloadedCount += 1
    } else {
      failedCount += 1
    }
  }

  const hasFailure = failedCount > 0 || downloadedCount < expectedCount

  logger.info(
    {
      tweetId,
      dir: dateMediaDir,
      expectedCount,
      downloadedCount,
      failedCount,
      hasFailure,
    },
    'Media download completed',
  )

  return {
    downloadedPaths,
    expectedCount,
    downloadedCount,
    failedCount,
    hasFailure,
  }
}

async function downloadImages(
  urls: string[],
  destDir: string,
  tweetId: string,
): Promise<{ downloadedPaths: string[]; downloadedCount: number; failedCount: number }> {
  const downloadedPaths: string[] = []
  let failedCount = 0

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    const downloadedPath = await downloadSingleImageWithRetry(url, destDir, tweetId, i + 1)

    if (downloadedPath) {
      downloadedPaths.push(downloadedPath)
    } else {
      failedCount += 1
    }
  }

  return {
    downloadedPaths,
    downloadedCount: downloadedPaths.length,
    failedCount,
  }
}

async function downloadSingleImageWithRetry(
  url: string,
  destDir: string,
  tweetId: string,
  index: number,
): Promise<string | null> {
  const maxAttempts = config.download.maxRetries + 1

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let ext = '.jpg'
      if (url.includes('.png') || url.includes('format=png')) ext = '.png'
      if (url.includes('.gif')) ext = '.gif'

      const fileName = tweetId + '_' + index + ext
      const filePath = join(destDir, fileName)

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('HTTP ' + response.status)
      }

      const buffer = await response.arrayBuffer()
      await writeFile(filePath, Buffer.from(buffer))

      logger.debug({ tweetId, filePath, attempt }, 'Image downloaded')
      return filePath
    } catch (error) {
      if (attempt < maxAttempts) {
        logger.warn(
          { tweetId, url: url.substring(0, 120), attempt, maxAttempts },
          'Image download failed, retrying in 1 second',
        )
        await wait(RETRY_DELAY_MS)
      } else {
        logger.error(
          { tweetId, url: url.substring(0, 120), error, maxAttempts },
          'Image download failed after retries',
        )
      }
    }
  }

  return null
}

async function downloadWithYtdlp(tweetUrl: string, destDir: string, tweetId: string): Promise<string[]> {
  const maxAttempts = config.download.maxRetries + 1

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const downloadedPaths = await runYtdlpOnce(tweetUrl, destDir, tweetId)
      if (downloadedPaths.length === 0) {
        throw new Error('yt-dlp completed but no media file was found')
      }
      return downloadedPaths
    } catch (error) {
      if (attempt < maxAttempts) {
        logger.warn(
          { tweetId, attempt, maxAttempts, error },
          'yt-dlp download failed, retrying in 1 second',
        )
        await wait(RETRY_DELAY_MS)
      } else {
        logger.error({ tweetId, error, maxAttempts }, 'yt-dlp download failed after retries')
      }
    }
  }

  return []
}

async function runYtdlpOnce(tweetUrl: string, destDir: string, tweetId: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const outputTemplate = join(destDir, tweetId + '_video.%(ext)s')

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
      if (code !== 0) {
        reject(new Error('yt-dlp exited with code ' + code + ': ' + stderr.substring(0, 500)))
        return
      }

      try {
        const files = await readdir(destDir)
        const downloadedPaths = files
          .filter((file) => file.startsWith(tweetId) && file.includes('_video'))
          .map((file) => join(destDir, file))

        logger.info({ tweetId, files: downloadedPaths }, 'yt-dlp download successful')
        resolve(downloadedPaths)
      } catch (error) {
        reject(error)
      }
    })

    proc.on('error', (error) => {
      reject(error)
    })
  })
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
