// Config API routes
import { FastifyInstance } from 'fastify'
import { existsSync, mkdirSync } from 'fs'
import { loadConfig, saveConfig, getBaseMediaDir } from '../services/config-store.js'
import { getAllBookmarks } from '../db/bookmarks.js'
import { logger } from '../utils/logger.js'

interface ConfigUpdateBody {
  mediaDir: string
}

export function registerConfigRoutes(app: FastifyInstance): void {
  // GET /api/config - Get current configuration and stats
  app.get('/api/config', async (_request, _reply) => {
    try {
      const config = loadConfig()
      const bookmarks = getAllBookmarks()
      
      const today = new Date()
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
      
      const todayCount = bookmarks.filter(b => {
        const bookmarkDate = b.bookmarkTime.split('T')[0]
        return bookmarkDate === todayStr
      }).length
      
      return {
        mediaDir: config.mediaDir || getBaseMediaDir(),
        serverVersion: '1.0.0',
        todayCount,
        totalCount: bookmarks.length,
        updatedAt: config.updatedAt,
      }
    } catch (error) {
      logger.error({ error }, 'Failed to get config')
      return { error: 'Failed to get config' }
    }
  })

  // POST /api/config - Update configuration
  app.post<{ Body: ConfigUpdateBody }>('/api/config', async (request, reply) => {
    try {
      const { mediaDir } = request.body
      
      if (!mediaDir || typeof mediaDir !== 'string' || mediaDir.trim().length === 0) {
        reply.code(400)
        return { success: false, error: '请输入存储路径' }
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
        return { success: false, error: '无法创建目录: ' + normalizedPath }
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
