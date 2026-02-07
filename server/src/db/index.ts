// Database initialization and connection using sql.js (pure JavaScript SQLite)
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'

let db: SqlJsDatabase | null = null

export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export async function initDatabase(): Promise<void> {
  // Ensure directory exists
  const dbDir = dirname(config.dbPath)
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
    logger.info(`Created database directory: ${dbDir}`)
  }

  // Initialize sql.js
  const SQL = await initSqlJs()

  // Load existing database or create new one
  if (existsSync(config.dbPath)) {
    const fileBuffer = readFileSync(config.dbPath)
    db = new SQL.Database(fileBuffer)
    logger.info(`Database loaded from: ${config.dbPath}`)
  } else {
    db = new SQL.Database()
    logger.info(`Created new database: ${config.dbPath}`)
  }

  // Run migrations
  migrate()

  // Save database
  saveDatabase()
}

function migrate(): void {
  if (!db) return

  logger.info('Running database migrations...')

  // Create bookmarks table
  db.run(`
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
      media_download_failed INTEGER DEFAULT 0,
      quoted_tweet_url TEXT,
      status TEXT DEFAULT 'pending',
      bookmark_time TEXT,
      raw_html TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  ensureColumn('bookmarks', 'media_download_failed', "INTEGER DEFAULT 0")

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_bookmarks_tweet_id ON bookmarks(tweet_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_bookmarks_author_id ON bookmarks(author_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_bookmarks_status ON bookmarks(status)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at)`)

  logger.info('Database migrations completed')
}

function ensureColumn(tableName: string, columnName: string, definition: string): void {
  if (!db || hasColumn(tableName, columnName)) {
    return
  }

  db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
  logger.info(`Added column ${columnName} to ${tableName}`)
}

function hasColumn(tableName: string, columnName: string): boolean {
  if (!db) {
    return false
  }

  const result = db.exec(`PRAGMA table_info(${tableName})`)
  if (result.length === 0) {
    return false
  }

  const nameIndex = result[0].columns.indexOf('name')
  if (nameIndex === -1) {
    return false
  }

  return result[0].values.some((row: unknown[]) => row[nameIndex] === columnName)
}

export function saveDatabase(): void {
  if (!db) return

  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(config.dbPath, buffer)
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase()
    db.close()
    db = null
    logger.info('Database connection closed')
  }
}

// Auto-save database periodically
setInterval(() => {
  if (db) {
    saveDatabase()
  }
}, 30000) // Every 30 seconds
