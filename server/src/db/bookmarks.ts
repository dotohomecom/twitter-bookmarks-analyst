// Bookmark repository - database operations
import { getDb, saveDatabase } from './index.js'
import { Bookmark, BookmarkInput, BookmarkStatus } from '../types.js'

export function createBookmark(input: BookmarkInput): Bookmark {
  const db = getDb()

  // Check if exists
  const existing = db.exec(`SELECT id FROM bookmarks WHERE tweet_id = ?`, [input.tweetId])

  if (existing.length > 0 && existing[0].values.length > 0) {
    // Update existing
    db.run(`
      UPDATE bookmarks SET
        text = ?,
        media_type = ?,
        media_urls = ?,
        media_download_failed = 0,
        updated_at = datetime('now')
      WHERE tweet_id = ?
    `, [
      input.text || null,
      input.mediaType || 'none',
      JSON.stringify(input.mediaUrls || []),
      input.tweetId,
    ])

    const result = db.exec(`SELECT * FROM bookmarks WHERE tweet_id = ?`, [input.tweetId])
    saveDatabase()
    return rowToBookmark(result[0].columns, result[0].values[0])
  }

  // Insert new
  db.run(`
    INSERT INTO bookmarks (
      tweet_id, url, author_id, author_name, author_handle,
      text, media_type, media_urls, media_paths, media_download_failed,
      quoted_tweet_url, status, bookmark_time, raw_html
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    input.tweetId,
    input.url,
    input.authorId,
    input.authorName || null,
    input.authorHandle || null,
    input.text || null,
    input.mediaType || 'none',
    JSON.stringify(input.mediaUrls || []),
    JSON.stringify([]),
    0,
    input.quotedTweetUrl || null,
    'pending',
    input.bookmarkTime || new Date().toISOString(),
    input.rawHtml || null,
  ])

  const result = db.exec(`SELECT * FROM bookmarks WHERE tweet_id = ?`, [input.tweetId])
  saveDatabase()
  return rowToBookmark(result[0].columns, result[0].values[0])
}

export function getBookmarkById(id: number): Bookmark | null {
  const db = getDb()
  const result = db.exec(`SELECT * FROM bookmarks WHERE id = ?`, [id])

  if (result.length === 0 || result[0].values.length === 0) {
    return null
  }

  return rowToBookmark(result[0].columns, result[0].values[0])
}

export function getBookmarkByTweetId(tweetId: string): Bookmark | null {
  const db = getDb()
  const result = db.exec(`SELECT * FROM bookmarks WHERE tweet_id = ?`, [tweetId])

  if (result.length === 0 || result[0].values.length === 0) {
    return null
  }

  return rowToBookmark(result[0].columns, result[0].values[0])
}

export function getAllBookmarks(limit = 100, offset = 0): Bookmark[] {
  const db = getDb()
  const result = db.exec(`
    SELECT * FROM bookmarks
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [limit, offset])

  if (result.length === 0) {
    return []
  }

  return result[0].values.map((row: unknown[]) => rowToBookmark(result[0].columns, row))
}

export function getBookmarksByStatus(status: BookmarkStatus, limit = 100): Bookmark[] {
  const db = getDb()
  const result = db.exec(`
    SELECT * FROM bookmarks
    WHERE status = ?
    ORDER BY created_at DESC
    LIMIT ?
  `, [status, limit])

  if (result.length === 0) {
    return []
  }

  return result[0].values.map((row: unknown[]) => rowToBookmark(result[0].columns, row))
}

export function updateBookmarkStatus(id: number, status: BookmarkStatus, mediaDownloadFailed?: boolean): void {
  const db = getDb()

  if (typeof mediaDownloadFailed === 'boolean') {
    db.run(`
      UPDATE bookmarks
      SET status = ?, media_download_failed = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [status, mediaDownloadFailed ? 1 : 0, id])
  } else {
    db.run(`
      UPDATE bookmarks
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [status, id])
  }

  saveDatabase()
}

export function updateBookmarkMediaResult(id: number, mediaPaths: string[], mediaDownloadFailed: boolean): void {
  const db = getDb()
  const status: BookmarkStatus = mediaDownloadFailed ? 'failed' : 'completed'

  db.run(`
    UPDATE bookmarks
    SET media_paths = ?, media_download_failed = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `, [JSON.stringify(mediaPaths), mediaDownloadFailed ? 1 : 0, status, id])

  saveDatabase()
}

export function getBookmarksCount(): number {
  const db = getDb()
  const result = db.exec('SELECT COUNT(*) as count FROM bookmarks')

  if (result.length === 0 || result[0].values.length === 0) {
    return 0
  }

  return result[0].values[0][0] as number
}

export function deleteBookmark(id: number): boolean {
  const db = getDb()
  const before = getBookmarksCount()
  db.run('DELETE FROM bookmarks WHERE id = ?', [id])
  const after = getBookmarksCount()
  saveDatabase()
  return before > after
}

// Convert database row to Bookmark object
function rowToBookmark(columns: string[], values: unknown[]): Bookmark {
  const row: Record<string, unknown> = {}
  columns.forEach((col, i) => {
    row[col] = values[i]
  })

  return {
    id: row.id as number,
    tweetId: row.tweet_id as string,
    url: row.url as string,
    authorId: row.author_id as string,
    authorName: (row.author_name as string) || '',
    authorHandle: (row.author_handle as string) || '',
    text: (row.text as string) || '',
    mediaType: (row.media_type as Bookmark['mediaType']) || 'none',
    mediaUrls: row.media_urls ? JSON.parse(row.media_urls as string) : [],
    mediaPaths: row.media_paths ? JSON.parse(row.media_paths as string) : [],
    mediaDownloadFailed: Boolean(row.media_download_failed),
    quotedTweetUrl: (row.quoted_tweet_url as string) || undefined,
    status: (row.status as BookmarkStatus) || 'pending',
    bookmarkTime: (row.bookmark_time as string) || '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
