// Media downloader service - uses date-based directories from user config
import { mkdir, writeFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { getMediaDir } from './config-store.js'

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

  // Get date-based media directory from config (e.g., D:\media\2026-02-06)
  const dateMediaDir = getMediaDir()
  
  if (!existsSync(dateMediaDir)) {
    await mkdir(dateMediaDir, { recursive: true })
    logger.info({ path: dateMediaDir }, 'Created date-based media directory')
  }

  if (mediaUrls.length > 0) {
    const imagePaths = await downloadImages(mediaUrls, dateMediaDir, tweetId)
    downloadedPaths.push(...imagePaths)
  }

  if (mediaType === 'video' || mediaType === 'gif') {
    try {
      const videoPaths = await downloadWithYtdlp(tweetUrl, dateMediaDir, tweetId)
      downloadedPaths.push(...videoPaths)
    } catch (error) {
      logger.warn({ tweetId, error }, 'yt-dlp download failed')
    }
  }

  logger.info({ tweetId, dir: dateMediaDir, downloadedCount: downloadedPaths.length }, 'Media download completed')
  return downloadedPaths
}

async function downloadImages(urls: string[], destDir: string, tweetId: string): Promise<string[]> {
  const downloadedPaths: string[] = []
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    if (!url.includes('twimg.com')) continue

    try {
      let ext = '.jpg'
      if (url.includes('.png') || url.includes('format=png')) ext = '.png'
      if (url.includes('.gif')) ext = '.gif'
      
      const fileName = tweetId + '_' + (i + 1) + ext
      const filePath = join(destDir, fileName)

      const response = await fetch(url)
      if (!response.ok) throw new Error('HTTP ' + response.status)

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

async function downloadWithYtdlp(tweetUrl: string, destDir: string, tweetId: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const outputTemplate = join(destDir, tweetId + '_video.%(ext)s')
    
    const args = [
      tweetUrl, '-o', outputTemplate,
      '--no-warnings', '--no-progress',
      '-f', 'best[ext=mp4]/best',
      '--remote-components', 'ejs:npm',
      '--no-check-certificates',
      '--extractor-args', 'twitter:api=syndication',
    ]

    logger.debug({ cmd: config.ytdlpPath, args: args.slice(0, 5) }, 'Running yt-dlp')

    const proc = spawn(config.ytdlpPath, args, {
      cwd: destDir,
      shell: true,
      env: { ...process.env, PATH: process.env.PATH },
    })

    let stderr = ''
    proc.stderr.on('data', (data) => { stderr += data.toString() })

    proc.on('close', async (code) => {
      if (code !== 0) {
        logger.error({ code, stderr: stderr.substring(0, 500) }, 'yt-dlp failed')
        reject(new Error('yt-dlp exited with code ' + code))
        return
      }
      try {
        const files = await readdir(destDir)
        const downloadedPaths = files
          .filter(f => f.startsWith(tweetId) && f.includes('_video'))
          .map(f => join(destDir, f))
        logger.info({ tweetId, files: downloadedPaths }, 'yt-dlp download successful')
        resolve(downloadedPaths)
      } catch (error) {
        reject(error)
      }
    })

    proc.on('error', () => { resolve([]) })
  })
}
