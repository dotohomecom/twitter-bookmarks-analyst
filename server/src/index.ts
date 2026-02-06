// Main server entry point
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { bookmarkRoutes } from './api/bookmarks.js'
import { healthRoutes } from './api/health.js'
import { registerDashboard } from './api/dashboard.js'
import { initDatabase } from './db/index.js'
import { initMediaQueue } from './queue/media-queue.js'
import { setupDependencies } from './utils/dependency-checker.js'
import { config } from './config.js'
import { logger } from './utils/logger.js'
import { existsSync, mkdirSync } from 'fs'

async function main() {
  logger.info('='.repeat(50))
  logger.info('Twitter Bookmarks Analyst - Server Starting')
  logger.info('='.repeat(50))

  // 1. Check and setup dependencies (Deno, yt-dlp)
  logger.info('Step 1: Checking dependencies...')
  const depStatus = await setupDependencies()
  
  if (!depStatus.ytdlp) {
    logger.warn('⚠️  yt-dlp not available - video downloads will be skipped')
  }
  if (!depStatus.deno) {
    logger.warn('⚠️  Deno not available - EJS challenge solver may not work')
  }

  // 2. Initialize database
  logger.info('Step 2: Initializing database...')
  await initDatabase()

  // 3. Ensure media directory exists
  if (!existsSync(config.mediaDir)) {
    mkdirSync(config.mediaDir, { recursive: true })
    logger.info(`Created media directory: ${config.mediaDir}`)
  }

  // 4. Initialize media download queue
  logger.info('Step 3: Initializing media queue...')
  await initMediaQueue()

  // 5. Create Fastify instance
  const app = Fastify({
    logger: true,
  })

  // Register CORS
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })

  // Serve static media files
  await app.register(fastifyStatic, {
    root: config.mediaDir,
    prefix: '/media/',
    decorateReply: false,
  })

  // Register routes
  await app.register(healthRoutes, { prefix: '/api' })
  await app.register(bookmarkRoutes, { prefix: '/api' })
  
  // Register dashboard
  registerDashboard(app)

  // Root redirect to dashboard
  app.get('/', async (_request, reply) => {
    return reply.redirect('/dashboard')
  })

  // Start server
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' })
    logger.info('='.repeat(50))
    logger.info(`✅ Server running at http://localhost:${config.port}`)
    logger.info(`📊 Dashboard: http://localhost:${config.port}/dashboard`)
    logger.info(`📦 Dependencies: yt-dlp=${depStatus.ytdlpVersion || 'N/A'}, deno=${depStatus.denoVersion || 'N/A'}`)
    logger.info('='.repeat(50))
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}

main()
