// Config API routes
import { FastifyInstance } from 'fastify'
import { existsSync, mkdirSync } from 'fs'
import { getAllBookmarks, getBookmarksCount } from '../db/bookmarks.js'
import { browseMediaDirectory } from '../services/media-directory-picker.js'
import { getBaseMediaDir, loadConfig, saveConfig } from '../services/config-store.js'
import { Bookmark } from '../types.js'
import { logger } from '../utils/logger.js'

interface ConfigUpdateBody {
  mediaDir: string
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

function parseTimestamp(rawValue: string | undefined): number | null {
  if (!rawValue) {
    return null
  }

  const value = rawValue.trim()
  if (!value) {
    return null
  }

  const direct = Date.parse(value)
  if (!Number.isNaN(direct)) {
    return direct
  }

  const sqliteDate = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(value)
  if (sqliteDate) {
    const localStyle = Date.parse(sqliteDate[1] + 'T' + sqliteDate[2])
    if (!Number.isNaN(localStyle)) {
      return localStyle
    }

    const utcStyle = Date.parse(sqliteDate[1] + 'T' + sqliteDate[2] + 'Z')
    if (!Number.isNaN(utcStyle)) {
      return utcStyle
    }
  }

  return null
}

function getBookmarkTimestamp(bookmark: Bookmark): number | null {
  return parseTimestamp(bookmark.bookmarkTime) ?? parseTimestamp(bookmark.createdAt)
}

function getTodayCount(bookmarks: Bookmark[]): number {
  const now = new Date()
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const startMs = dayStart.getTime()
  const endMs = dayEnd.getTime()

  return bookmarks.reduce((count, bookmark) => {
    const timestamp = getBookmarkTimestamp(bookmark)

    if (timestamp === null) {
      return count
    }

    return timestamp >= startMs && timestamp < endMs ? count + 1 : count
  }, 0)
}

export function registerConfigRoutes(app: FastifyInstance): void {
  // GET /api/config - Get current configuration and stats
  app.get('/api/config', async (_request, _reply) => {
    try {
      const config = loadConfig()
      const totalCount = getBookmarksCount()
      const bookmarks = totalCount > 0 ? getAllBookmarks(totalCount, 0) : []
      const todayCount = getTodayCount(bookmarks)

      return {
        mediaDir: config.mediaDir || getBaseMediaDir(),
        serverVersion: '1.0.0',
        todayCount,
        totalCount,
        serverLocalDate: formatLocalDate(new Date()),
        updatedAt: config.updatedAt,
      }
    } catch (error) {
      logger.error({ error }, 'Failed to get config')
      return { error: 'Failed to get config' }
    }
  })

  // POST /api/config/browse-media-dir - Open directory picker and return selected path
  app.post('/api/config/browse-media-dir', async (_request, reply) => {
    const result = await browseMediaDirectory()

    if (result.success) {
      return result
    }

    if (result.cancelled) {
      return {
        success: false,
        cancelled: true,
        error: result.error || 'Directory selection was cancelled.',
      }
    }

    reply.code(process.platform === 'win32' ? 500 : 501)
    return {
      success: false,
      error: result.error || 'Failed to open directory picker.',
    }
  })

  // POST /api/config - Update configuration
  app.post<{ Body: ConfigUpdateBody }>('/api/config', async (request, reply) => {
    try {
      const { mediaDir } = request.body

      if (!mediaDir || typeof mediaDir !== 'string' || mediaDir.trim().length === 0) {
        reply.code(400)
        return { success: false, error: 'Please provide a media directory path.' }
      }

      const normalizedPath = mediaDir.trim()

      try {
        if (!existsSync(normalizedPath)) {
          mkdirSync(normalizedPath, { recursive: true })
          logger.info({ path: normalizedPath }, 'Created media directory')
        }
      } catch (mkdirError) {
        logger.error({ error: mkdirError, path: normalizedPath }, 'Failed to create directory')
        reply.code(400)
        return { success: false, error: 'Unable to create directory: ' + normalizedPath }
      }

      const newConfig = saveConfig({ mediaDir: normalizedPath })
      logger.info({ mediaDir: normalizedPath }, 'Config updated')

      return {
        success: true,
        mediaDir: newConfig.mediaDir,
        updatedAt: newConfig.updatedAt,
      }
    } catch (error) {
      logger.error({ error }, 'Failed to update config')
      reply.code(500)
      return { success: false, error: 'Failed to update config' }
    }
  })
}
