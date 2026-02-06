// Main server entry point
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { bookmarkRoutes } from './api/bookmarks.js'
import { healthRoutes } from './api/health.js'
import { registerDashboard } from './api/dashboard.js'
import { registerConfigRoutes } from './api/config.js'
import { initDatabase } from './db/index.js'
import { initMediaQueue } from './queue/media-queue.js'
import { setupDependencies } from './utils/dependency-checker.js'
import { config } from './config.js'
import { logger } from './utils/logger.js'
import { existsSync, mkdirSync } from 'fs'
import { getBaseMediaDir } from './services/config-store.js'

async function main() {
  logger.info('='.repeat(50))
  logger.info('Twitter Bookmarks Analyst - Server Starting')
  logger.info('='.repeat(50))

  logger.info('Step 1: Checking dependencies...')
  const depStatus = await setupDependencies()
  
  if (!depStatus.ytdlp) {
    logger.warn('⚠️  yt-dlp not available - video downloads will be skipped')
  }
  if (!depStatus.deno) {
    logger.warn('⚠️  Deno not available - EJS challenge solver may not work')
  }

  logger.info('Step 2: Initializing database...')
  await initDatabase()

  const mediaDir = getBaseMediaDir()
  if (!existsSync(mediaDir)) {
    mkdirSync(mediaDir, { recursive: true })
    logger.info('Created media directory: ' + mediaDir)
  }

  logger.info('Step 3: Initializing media queue...')
  await initMediaQueue()

  const app = Fastify({ logger: true })

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })

  await app.register(fastifyStatic, {
    root: mediaDir,
    prefix: '/media/',
    decorateReply: false,
  })

  await app.register(healthRoutes, { prefix: '/api' })
  await app.register(bookmarkRoutes, { prefix: '/api' })
  
  registerConfigRoutes(app)
  registerDashboard(app)

  app.get('/', async (_request, reply) => {
    return reply.redirect('/dashboard')
  })

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' })
    logger.info('='.repeat(50))
    logger.info('✅ Server running at http://localhost:' + config.port)
    logger.info('📊 Dashboard: http://localhost:' + config.port + '/dashboard')
    logger.info('📁 Media directory: ' + mediaDir)
    logger.info('📦 Dependencies: yt-dlp=' + (depStatus.ytdlpVersion || 'N/A') + ', deno=' + (depStatus.denoVersion || 'N/A'))
    logger.info('='.repeat(50))
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}

main()
