// Media downloader service
// Handles downloading images and videos from tweets

import { mkdir, writeFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
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
  if (mediaUrls.length > 0) {
    const imagePaths = await downloadImages(mediaUrls, tweetMediaDir, tweetId)
    downloadedPaths.push(...imagePaths)
  }

  // Use yt-dlp for videos
  if (mediaType === 'video' || mediaType === 'gif') {
    try {
      const videoPaths = await downloadWithYtdlp(tweetUrl, tweetMediaDir, tweetId)
      downloadedPaths.push(...videoPaths)
    } catch (error) {
      logger.warn({ tweetId, error }, 'yt-dlp download failed (may not be installed)')
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
    if (!url.includes('twimg.com')) {
      continue
    }

    try {
      // Determine file extension
      let ext = '.jpg'
      if (url.includes('.png') || url.includes('format=png')) ext = '.png'
      if (url.includes('.gif')) ext = '.gif'
      
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
      logger.debug({ url: url.substring(0, 50), filePath }, 'Image downloaded')
    } catch (error) {
      logger.error({ url: url.substring(0, 50), error }, 'Failed to download image')
    }
  }

  return downloadedPaths
}

/**
 * Download video using yt-dlp with EJS challenge solver
 * 
 * Key parameters:
 * - --remote-components ejs:npm : Install EJS challenge solver script (uses Deno)
 * - -f best[ext=mp4]/best : Prefer MP4 format
 * - --no-warnings : Suppress warnings
 */
async function downloadWithYtdlp(
  tweetUrl: string,
  destDir: string,
  tweetId: string
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const outputTemplate = join(destDir, `${tweetId}_video.%(ext)s`)
    
    const args = [
      tweetUrl,
      '-o', outputTemplate,
      '--no-warnings',
      '--no-progress',
      '-f', 'best[ext=mp4]/best',
      // EJS challenge solver - requires Deno to be installed
      '--remote-components', 'ejs:npm',
      // Additional recommended options for Twitter/X
      '--no-check-certificates',
      '--extractor-args', 'twitter:api=syndication',
    ]

    logger.debug({ cmd: config.ytdlpPath, args: args.slice(0, 5) }, 'Running yt-dlp with EJS solver')

    const proc = spawn(config.ytdlpPath, args, {
      cwd: destDir,
      shell: true,
      env: {
        ...process.env,
        // Ensure Deno is available for EJS solver
        PATH: process.env.PATH,
      },
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
      logger.debug({ stdout: data.toString().trim() }, 'yt-dlp stdout')
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', async (code) => {
      if (code !== 0) {
        logger.error({ code, stderr: stderr.substring(0, 500) }, 'yt-dlp failed')
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr.substring(0, 200)}`))
        return
      }

      // Find downloaded files
      try {
        const files = await readdir(destDir)
        const downloadedPaths = files
          .filter(f => f.includes('_video'))
          .map(f => join(destDir, f))
        
        logger.info({ tweetId, files: downloadedPaths }, 'yt-dlp download successful')
        resolve(downloadedPaths)
      } catch (error) {
        reject(error)
      }
    })

    proc.on('error', (error) => {
      // yt-dlp not installed is ok
      logger.debug({ error: error.message }, 'yt-dlp not available')
      resolve([])
    })
  })
}
