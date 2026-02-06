// Bookmark API routes
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  createBookmark,
  getAllBookmarks,
  getBookmarkById,
  getBookmarkByTweetId,
  deleteBookmark,
  getBookmarksCount,
} from '../db/bookmarks.js'
import { addMediaDownloadJob } from '../queue/media-queue.js'
import { logger } from '../utils/logger.js'
import { ApiResponse, Bookmark } from '../types.js'

// Validation schema for bookmark input
const bookmarkInputSchema = z.object({
  tweetId: z.string().min(1),
  url: z.string().url(),
  authorId: z.string().min(1),
  authorName: z.string().optional(),
  authorHandle: z.string().optional(),
  text: z.string().optional(),
  mediaType: z.enum(['none', 'image', 'video', 'gif', 'mixed']).optional(),
  mediaUrls: z.array(z.string()).optional(),
  quotedTweetUrl: z.string().optional(),
  bookmarkTime: z.string().optional(),
  rawHtml: z.string().optional(),
})

export const bookmarkRoutes: FastifyPluginAsync = async (app) => {
  // Create bookmark
  app.post<{ Body: z.infer<typeof bookmarkInputSchema> }>(
    '/bookmarks',
    async (request, reply) => {
      try {
        // Validate input
        const input = bookmarkInputSchema.parse(request.body)
        
        logger.info({ tweetId: input.tweetId }, 'Received bookmark request')

        // Check if bookmark already exists
        const existing = getBookmarkByTweetId(input.tweetId)
        if (existing) {
          logger.info({ tweetId: input.tweetId }, 'Bookmark already exists, updating...')
        }

        // Create or update bookmark
        const bookmark = createBookmark(input)
        
        logger.info({ id: bookmark.id, tweetId: bookmark.tweetId }, 'Bookmark saved')

        // Queue media download if there are media URLs
        if (input.mediaUrls && input.mediaUrls.length > 0) {
          await addMediaDownloadJob({
            bookmarkId: bookmark.id,
            tweetId: bookmark.tweetId,
            tweetUrl: bookmark.url,
            mediaUrls: input.mediaUrls,
            mediaType: input.mediaType || 'none',
          })
          logger.info({ id: bookmark.id, mediaCount: input.mediaUrls.length }, 'Media download job queued')
        } else if (input.mediaType === 'video') {
          // Video might not have direct URL, queue for yt-dlp download
          await addMediaDownloadJob({
            bookmarkId: bookmark.id,
            tweetId: bookmark.tweetId,
            tweetUrl: bookmark.url,
            mediaUrls: [],
            mediaType: 'video',
          })
          logger.info({ id: bookmark.id }, 'Video download job queued (yt-dlp)')
        }

        const response: ApiResponse<Bookmark> = {
          success: true,
          data: bookmark,
          message: 'Bookmark saved successfully',
        }

        return reply.code(201).send(response)
      } catch (error) {
        logger.error({ error }, 'Failed to create bookmark')
        
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            success: false,
            error: 'Validation error',
            details: error.errors,
          })
        }

        return reply.code(500).send({
          success: false,
          error: (error as Error).message,
        })
      }
    }
  )

  // Get all bookmarks
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/bookmarks',
    async (request, reply) => {
      try {
        const limit = parseInt(request.query.limit || '100', 10)
        const offset = parseInt(request.query.offset || '0', 10)
        
        const bookmarks = getAllBookmarks(limit, offset)
        const total = getBookmarksCount()

        return reply.send({
          success: true,
          data: bookmarks,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + bookmarks.length < total,
          },
        })
      } catch (error) {
        logger.error({ error }, 'Failed to get bookmarks')
        return reply.code(500).send({
          success: false,
          error: (error as Error).message,
        })
      }
    }
  )

  // Get bookmark by ID
  app.get<{ Params: { id: string } }>(
    '/bookmarks/:id',
    async (request, reply) => {
      try {
        const id = parseInt(request.params.id, 10)
        const bookmark = getBookmarkById(id)

        if (!bookmark) {
          return reply.code(404).send({
            success: false,
            error: 'Bookmark not found',
          })
        }

        return reply.send({
          success: true,
          data: bookmark,
        })
      } catch (error) {
        logger.error({ error }, 'Failed to get bookmark')
        return reply.code(500).send({
          success: false,
          error: (error as Error).message,
        })
      }
    }
  )

  // Delete bookmark
  app.delete<{ Params: { id: string } }>(
    '/bookmarks/:id',
    async (request, reply) => {
      try {
        const id = parseInt(request.params.id, 10)
        const deleted = deleteBookmark(id)

        if (!deleted) {
          return reply.code(404).send({
            success: false,
            error: 'Bookmark not found',
          })
        }

        return reply.send({
          success: true,
          message: 'Bookmark deleted successfully',
        })
      } catch (error) {
        logger.error({ error }, 'Failed to delete bookmark')
        return reply.code(500).send({
          success: false,
          error: (error as Error).message,
        })
      }
    }
  )
}
