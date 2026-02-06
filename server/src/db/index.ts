// Database initialization and connection
import Database from 'better-sqlite3'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { mkdirSync, existsSync } from 'fs'
import { dirname } from 'path'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function initDatabase(): void {
  // Ensure directory exists
  const dbDir = dirname(config.dbPath)
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
    logger.info(`Created database directory: ${dbDir}`)
  }

  // Create database connection
  db = new Database(config.dbPath)
  db.pragma('journal_mode = WAL')
  
  logger.info(`Database connected: ${config.dbPath}`)

  // Run migrations
  migrate()
}

function migrate(): void {
  logger.info('Running database migrations...')

  // Create bookmarks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tweet_id TEXT UNIQUE NOT NULL,
      url TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT,
      author_handle TEXT,
      text TEXT,
      media_type TEXT DEFAULT 'none',
      media_urls TEXT,
      media_paths TEXT,
      quoted_tweet_url TEXT,
      status TEXT DEFAULT 'pending',
      bookmark_time TEXT,
      raw_html TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_bookmarks_tweet_id ON bookmarks(tweet_id);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_author_id ON bookmarks(author_id);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_status ON bookmarks(status);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at);
  `)

  // Create media_downloads table for tracking individual media files
  db.exec(`
    CREATE TABLE IF NOT EXISTS media_downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookmark_id INTEGER NOT NULL,
      original_url TEXT NOT NULL,
      local_path TEXT,
      file_name TEXT,
      file_size INTEGER,
      mime_type TEXT,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id)
    )
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_media_downloads_bookmark_id ON media_downloads(bookmark_id);
    CREATE INDEX IF NOT EXISTS idx_media_downloads_status ON media_downloads(status);
  `)

  logger.info('Database migrations completed')
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    logger.info('Database connection closed')
  }
}
