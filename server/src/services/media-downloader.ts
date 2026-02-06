// Media downloader service
// Handles downloading images, videos, and GIFs from tweets

import { mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, extname } from 'path'
import { spawn } from 'child_process'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

export interface DownloadRequest {
  bookmarkId: number
  tweetId: string
  tweetUrl: string
  mediaUrls: string[]
  mediaType: 'none' | 'image' | 'video' | 'gif' | 'mixed'
}

export async function downloadMedia(request: DownloadRequest): Promise<string[]> {
  const { tweetId, tweetUrl, mediaUrls, mediaType } = request
  const downloadedPaths: string[] = []

  // Create directory for this tweet's media
  const tweetMediaDir = join(config.mediaDir, tweetId)
  if (!existsSync(tweetMediaDir)) {
    await mkdir(tweetMediaDir, { recursive: true })
  }

  // Download images directly
  if (mediaType === 'image' || mediaType === 'mixed') {
    const imagePaths = await downloadImages(mediaUrls, tweetMediaDir, tweetId)
    downloadedPaths.push(...imagePaths)
  }

  // Use yt-dlp for videos
  if (mediaType === 'video' || mediaType === 'gif' || mediaType === 'mixed') {
    try {
      const videoPaths = await downloadWithYtdlp(tweetUrl, tweetMediaDir, tweetId)
      downloadedPaths.push(...videoPaths)
    } catch (error) {
      logger.warn({ tweetId, error }, 'yt-dlp download failed, trying direct download')
      // Fallback: try direct download of video URLs
      const videoUrls = mediaUrls.filter(url => 
        url.includes('.mp4') || url.includes('video')
      )
      const videoPaths = await downloadVideoDirect(videoUrls, tweetMediaDir, tweetId)
      downloadedPaths.push(...videoPaths)
    }
  }

  logger.info({ tweetId, downloadedCount: downloadedPaths.length }, 'Media download completed')
  return downloadedPaths
}

async function downloadImages(
  urls: string[], 
  destDir: string, 
  tweetId: string
): Promise<string[]> {
  const downloadedPaths: string[] = []
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    
    // Skip non-image URLs
    if (!url.includes('pbs.twimg.com') && !url.includes('.jpg') && !url.includes('.png')) {
      continue
    }

    try {
      // Determine file extension
      let ext = '.jpg'
      if (url.includes('.png')) ext = '.png'
      if (url.includes('.gif')) ext = '.gif'
      if (url.includes('format=png')) ext = '.png'
      
      const fileName = `${tweetId}_${i + 1}${ext}`
      const filePath = join(destDir, fileName)

      // Download the image
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const buffer = await response.arrayBuffer()
      await writeFile(filePath, Buffer.from(buffer))
      
      downloadedPaths.push(filePath)
      logger.debug({ url, filePath }, 'Image downloaded')
    } catch (error) {
      logger.error({ url, error }, 'Failed to download image')
    }
  }

  return downloadedPaths
}

async function downloadVideoDirect(
  urls: string[],
  destDir: string,
  tweetId: string
): Promise<string[]> {
  const downloadedPaths: string[] = []

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    
    try {
      const ext = extname(new URL(url).pathname) || '.mp4'
      const fileName = `${tweetId}_video_${i + 1}${ext}`
      const filePath = join(destDir, fileName)

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const buffer = await response.arrayBuffer()
      await writeFile(filePath, Buffer.from(buffer))
      
      downloadedPaths.push(filePath)
      logger.debug({ url, filePath }, 'Video downloaded directly')
    } catch (error) {
      logger.error({ url, error }, 'Failed to download video directly')
    }
  }

  return downloadedPaths
}

async function downloadWithYtdlp(
  tweetUrl: string,
  destDir: string,
  tweetId: string
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const outputTemplate = join(destDir, `${tweetId}_%(autonumber)s.%(ext)s`)
    
    const args = [
      tweetUrl,
      '-o', outputTemplate,
      '--no-warnings',
      '--no-progress',
      '-f', 'best[ext=mp4]/best',
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
    ]

    logger.debug({ cmd: config.ytdlpPath, args }, 'Running yt-dlp')

    const proc = spawn(config.ytdlpPath, args, {
      cwd: destDir,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', async (code) => {
      if (code !== 0) {
        logger.error({ code, stderr }, 'yt-dlp failed')
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`))
        return
      }

      // Find downloaded files
      try {
        const { readdir } = await import('fs/promises')
        const files = await readdir(destDir)
        const downloadedPaths = files
          .filter(f => f.startsWith(tweetId))
          .map(f => join(destDir, f))
        
        resolve(downloadedPaths)
      } catch (error) {
        reject(error)
      }
    })

    proc.on('error', (error) => {
      logger.error({ error }, 'Failed to spawn yt-dlp')
      reject(error)
    })
  })
}
