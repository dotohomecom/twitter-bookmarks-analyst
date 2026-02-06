// Bookmark repository - database operations
import { getDb } from './index.js'
import { Bookmark, BookmarkInput, BookmarkStatus } from '../types.js'

export function createBookmark(input: BookmarkInput): Bookmark {
  const db = getDb()
  
  const stmt = db.prepare(`
    INSERT INTO bookmarks (
      tweet_id, url, author_id, author_name, author_handle,
      text, media_type, media_urls, quoted_tweet_url,
      status, bookmark_time, raw_html
    ) VALUES (
      @tweetId, @url, @authorId, @authorName, @authorHandle,
      @text, @mediaType, @mediaUrls, @quotedTweetUrl,
      @status, @bookmarkTime, @rawHtml
    )
    ON CONFLICT(tweet_id) DO UPDATE SET
      text = @text,
      media_type = @mediaType,
      media_urls = @mediaUrls,
      updated_at = datetime('now')
    RETURNING *
  `)

  const row = stmt.get({
    tweetId: input.tweetId,
    url: input.url,
    authorId: input.authorId,
    authorName: input.authorName || null,
    authorHandle: input.authorHandle || null,
    text: input.text || null,
    mediaType: input.mediaType || 'none',
    mediaUrls: JSON.stringify(input.mediaUrls || []),
    quotedTweetUrl: input.quotedTweetUrl || null,
    status: 'pending',
    bookmarkTime: input.bookmarkTime || new Date().toISOString(),
    rawHtml: input.rawHtml || null,
  }) as BookmarkRow

  return rowToBookmark(row)
}

export function getBookmarkById(id: number): Bookmark | null {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM bookmarks WHERE id = ?')
  const row = stmt.get(id) as BookmarkRow | undefined
  return row ? rowToBookmark(row) : null
}

export function getBookmarkByTweetId(tweetId: string): Bookmark | null {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM bookmarks WHERE tweet_id = ?')
  const row = stmt.get(tweetId) as BookmarkRow | undefined
  return row ? rowToBookmark(row) : null
}

export function getAllBookmarks(limit = 100, offset = 0): Bookmark[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT * FROM bookmarks 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `)
  const rows = stmt.all(limit, offset) as BookmarkRow[]
  return rows.map(rowToBookmark)
}

export function getBookmarksByStatus(status: BookmarkStatus, limit = 100): Bookmark[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT * FROM bookmarks 
    WHERE status = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `)
  const rows = stmt.all(status, limit) as BookmarkRow[]
  return rows.map(rowToBookmark)
}

export function updateBookmarkStatus(id: number, status: BookmarkStatus): void {
  const db = getDb()
  const stmt = db.prepare(`
    UPDATE bookmarks 
    SET status = ?, updated_at = datetime('now') 
    WHERE id = ?
  `)
  stmt.run(status, id)
}

export function updateBookmarkMediaPaths(id: number, mediaPaths: string[]): void {
  const db = getDb()
  const stmt = db.prepare(`
    UPDATE bookmarks 
    SET media_paths = ?, status = 'completed', updated_at = datetime('now') 
    WHERE id = ?
  `)
  stmt.run(JSON.stringify(mediaPaths), id)
}

export function getBookmarksCount(): number {
  const db = getDb()
  const stmt = db.prepare('SELECT COUNT(*) as count FROM bookmarks')
  const result = stmt.get() as { count: number }
  return result.count
}

export function deleteBookmark(id: number): boolean {
  const db = getDb()
  const stmt = db.prepare('DELETE FROM bookmarks WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

// Type for raw database row
interface BookmarkRow {
  id: number
  tweet_id: string
  url: string
  author_id: string
  author_name: string | null
  author_handle: string | null
  text: string | null
  media_type: string
  media_urls: string | null
  media_paths: string | null
  quoted_tweet_url: string | null
  status: string
  bookmark_time: string | null
  raw_html: string | null
  created_at: string
  updated_at: string
}

// Convert database row to Bookmark object
function rowToBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    tweetId: row.tweet_id,
    url: row.url,
    authorId: row.author_id,
    authorName: row.author_name || '',
    authorHandle: row.author_handle || '',
    text: row.text || '',
    mediaType: row.media_type as Bookmark['mediaType'],
    mediaUrls: row.media_urls ? JSON.parse(row.media_urls) : [],
    mediaPaths: row.media_paths ? JSON.parse(row.media_paths) : [],
    quotedTweetUrl: row.quoted_tweet_url || undefined,
    status: row.status as BookmarkStatus,
    bookmarkTime: row.bookmark_time || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
