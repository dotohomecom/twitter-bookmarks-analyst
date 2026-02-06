// Health check API routes
import { FastifyPluginAsync } from 'fastify'
import { getBookmarksCount } from '../db/bookmarks.js'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Health check endpoint
  app.get('/health', async (_request, _reply) => {
    return {
      success: true,
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    }
  })

  // Get bookmarks count
  app.get('/bookmarks/count', async (_request, _reply) => {
    try {
      const count = getBookmarksCount()
      return {
        success: true,
        count,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        count: 0,
      }
    }
  })
}
