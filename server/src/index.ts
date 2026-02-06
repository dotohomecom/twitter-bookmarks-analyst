// Main server entry point
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { bookmarkRoutes } from './api/bookmarks.js'
import { healthRoutes } from './api/health.js'
import { registerDashboard } from './api/dashboard.js'
import { initDatabase } from './db/index.js'
import { initMediaQueue } from './queue/media-queue.js'
import { config } from './config.js'
import { logger } from './utils/logger.js'
import { existsSync, mkdirSync } from 'fs'

async function main() {
  // Initialize database
  logger.info('Initializing database...')
  initDatabase()

  // Ensure media directory exists
  if (!existsSync(config.mediaDir)) {
    mkdirSync(config.mediaDir, { recursive: true })
    logger.info(`Created media directory: ${config.mediaDir}`)
  }

  // Initialize media download queue
  logger.info('Initializing media queue...')
  await initMediaQueue()

  // Create Fastify instance
  const app = Fastify({
    logger: true,
  })

  // Register CORS
  await app.register(cors, {
    origin: true, // Allow all origins for extension
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
    logger.info(`Server running at http://localhost:${config.port}`)
    logger.info(`Dashboard available at http://localhost:${config.port}/dashboard`)
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}

main()
