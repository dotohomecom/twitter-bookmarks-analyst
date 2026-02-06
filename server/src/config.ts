// Server configuration
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  
  // Database
  dbPath: process.env.DB_PATH || join(__dirname, '..', 'data', 'bookmarks.db'),
  
  // Media storage
  mediaDir: process.env.MEDIA_DIR || join(__dirname, '..', 'media'),
  
  // Redis (for BullMQ)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  
  // Media download settings
  download: {
    maxConcurrent: 3,
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
  },
  
  // yt-dlp path (optional, uses PATH if not set)
  ytdlpPath: process.env.YTDLP_PATH || 'yt-dlp',
}
