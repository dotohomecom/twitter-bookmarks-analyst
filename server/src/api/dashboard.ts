// Simple dashboard for viewing bookmarks
import Fastify, { FastifyReply, FastifyRequest } from 'fastify'

export function registerDashboard(app: ReturnType<typeof Fastify>) {
  // Serve dashboard HTML
  app.get('/dashboard', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.type('text/html')
    return getDashboardHtml()
  })
}

function getDashboardHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Twitter Bookmarks Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e4e6eb;
    }

    .header {
      background: rgba(0,0,0,0.3);
      padding: 20px 40px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }

    .header h1 {
      font-size: 24px;
      background: linear-gradient(135deg, #1da1f2, #17bf63);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .stat-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .stat-value {
      font-size: 40px;
      font-weight: 700;
      background: linear-gradient(135deg, #1da1f2, #17bf63);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .stat-label {
      color: #8899a6;
      font-size: 14px;
      margin-top: 8px;
    }

    .bookmarks-grid {
      display: grid;
      gap: 20px;
    }

    .bookmark-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid rgba(255,255,255,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .bookmark-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }

    .bookmark-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1da1f2, #17bf63);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 20px;
    }

    .author-info h3 {
      font-size: 16px;
      font-weight: 600;
    }

    .author-info span {
      color: #8899a6;
      font-size: 14px;
    }

    .bookmark-text {
      font-size: 15px;
      line-height: 1.5;
      margin-bottom: 12px;
      word-break: break-word;
    }

    .bookmark-media {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }

    .bookmark-media img {
      width: 100%;
      border-radius: 8px;
      aspect-ratio: 16/9;
      object-fit: cover;
    }

    .bookmark-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      color: #8899a6;
      font-size: 12px;
      flex-wrap: wrap;
    }

    .footer-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-completed { background: rgba(23,191,99,0.2); color: #17bf63; }
    .status-pending { background: rgba(255,173,31,0.2); color: #ffad1f; }
    .status-failed { background: rgba(244,33,46,0.2); color: #f4212e; }
    .status-downloading { background: rgba(29,161,242,0.2); color: #1da1f2; }

    .media-indicator {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid transparent;
    }

    .media-indicator.completed {
      color: #17bf63;
      background: rgba(23,191,99,0.15);
      border-color: rgba(23,191,99,0.35);
    }

    .media-indicator.failed {
      color: #f4212e;
      background: rgba(244,33,46,0.15);
      border-color: rgba(244,33,46,0.35);
    }

    .media-indicator.pending {
      color: #ffad1f;
      background: rgba(255,173,31,0.15);
      border-color: rgba(255,173,31,0.35);
    }

    .media-progress {
      opacity: 0.85;
      margin-left: 2px;
    }

    .loading,
    .empty {
      text-align: center;
      padding: 60px;
      color: #8899a6;
    }

    a { color: #1da1f2; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Twitter Bookmarks Dashboard</h1>
  </div>

  <div class="container">
    <div class="stats" id="stats">
      <div class="stat-card">
        <div class="stat-value" id="totalCount">-</div>
        <div class="stat-label">Total Bookmarks</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="completedCount">-</div>
        <div class="stat-label">Media Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="failedCount">-</div>
        <div class="stat-label">Media Failed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="pendingCount">-</div>
        <div class="stat-label">Pending</div>
      </div>
    </div>

    <div class="bookmarks-grid" id="bookmarks">
      <div class="loading">Loading bookmarks...</div>
    </div>
  </div>

  <script>
    function getMediaProgress(bookmark) {
      if (!Array.isArray(bookmark.mediaItems) || bookmark.mediaItems.length === 0) {
        return null
      }

      const total = bookmark.mediaItems.length
      const completed = bookmark.mediaItems.filter((item) => item.status === 'completed').length
      const failed = bookmark.mediaItems.filter((item) => item.status === 'failed').length
      const pending = Math.max(0, total - completed - failed)

      return { total, completed, failed, pending }
    }

    function getMediaIndicator(bookmark) {
      if (bookmark.mediaType === 'none') {
        return ''
      }

      const progress = getMediaProgress(bookmark)
      if (progress) {
        const ratio = '<span class="media-progress">(' + progress.completed + '/' + progress.total + ')</span>'

        if (progress.failed > 0) {
          return '<span class="media-indicator failed" title="Media download failed">&#x274C; Media Failed ' + ratio + '</span>'
        }

        if (progress.completed === progress.total) {
          return '<span class="media-indicator completed" title="Media download completed">&#x2705; Media Done ' + ratio + '</span>'
        }

        return '<span class="media-indicator pending" title="Media is still downloading">&#x23F3; Media Pending ' + ratio + '</span>'
      }

      if (bookmark.mediaDownloadFailed) {
        return '<span class="media-indicator failed" title="Media download failed">&#x274C; Media Failed</span>'
      }

      if (bookmark.status === 'completed') {
        return '<span class="media-indicator completed" title="Media download completed">&#x2705; Media Done</span>'
      }

      return '<span class="media-indicator pending" title="Media is still downloading">&#x23F3; Media Pending</span>'
    }

    function extractFileName(pathValue) {
      const value = String(pathValue || '')
      if (!value) {
        return ''
      }

      const slashIndex = value.lastIndexOf('/')
      const backslashIndex = value.lastIndexOf(String.fromCharCode(92))
      const separatorIndex = Math.max(slashIndex, backslashIndex)

      if (separatorIndex === -1) {
        return value
      }

      return value.slice(separatorIndex + 1)
    }

    function extractDatePart(dateValue) {
      const value = String(dateValue || '').trim()
      if (!value) {
        return ''
      }

      if (value.includes('T')) {
        return value.split('T')[0]
      }

      if (value.includes(' ')) {
        return value.split(' ')[0]
      }

      return value.length >= 10 ? value.slice(0, 10) : ''
    }

    function toMediaUrl(path, bookmarkTime) {
      const fileName = extractFileName(path)
      const datePart = extractDatePart(bookmarkTime)

      if (!fileName || !datePart) {
        return ''
      }

      return '/media/' + encodeURIComponent(datePart) + '/' + encodeURIComponent(fileName)
    }

    function renderLoadError(message) {
      const container = document.getElementById('bookmarks')
      container.innerHTML = '<div class="empty">Failed to load bookmarks: ' + message + '</div>'
    }

    async function loadBookmarks() {
      try {
        const response = await fetch('/api/bookmarks?limit=50', {
          headers: {
            Accept: 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Request failed with status ' + response.status)
        }

        let data
        try {
          data = await response.json()
        } catch (_parseError) {
          throw new Error('Invalid JSON response from server')
        }

        if (!data || data.success !== true) {
          throw new Error((data && data.error) || 'Unexpected API response')
        }

        const bookmarks = Array.isArray(data.data) ? data.data : null
        if (!bookmarks) {
          throw new Error('Bookmarks payload is missing')
        }

        const total = data.pagination && typeof data.pagination.total === 'number'
          ? data.pagination.total
          : bookmarks.length
        document.getElementById('totalCount').textContent = String(total)

        const completed = bookmarks.filter((b) => b.status === 'completed' && !b.mediaDownloadFailed).length
        const failed = bookmarks.filter((b) => b.mediaDownloadFailed).length
        const pending = bookmarks.filter((b) => b.status === 'pending' || b.status === 'downloading').length

        document.getElementById('completedCount').textContent = String(completed)
        document.getElementById('failedCount').textContent = String(failed)
        document.getElementById('pendingCount').textContent = String(pending)

        const container = document.getElementById('bookmarks')

        if (bookmarks.length === 0) {
          container.innerHTML = '<div class="empty">No bookmarks yet. Start bookmarking tweets!</div>'
          return
        }

        container.innerHTML = bookmarks.map((bookmark) => {
          const authorName = bookmark.authorName || 'Unknown'
          const avatar = authorName.charAt(0).toUpperCase()
          const mediaIndicator = getMediaIndicator(bookmark)
          const mediaPaths = Array.isArray(bookmark.mediaPaths) ? bookmark.mediaPaths : []

          const mediaHtml = bookmark.mediaType !== 'none' && mediaPaths.length > 0
            ? '<div class="bookmark-media">' + mediaPaths.slice(0, 4).map((path) => {
              const mediaUrl = toMediaUrl(path, bookmark.bookmarkTime)
              if (!mediaUrl) {
                return ''
              }
              return '<img src="' + mediaUrl + '" alt="Media" onerror="this.style.display=&quot;none&quot;">'
            }).filter(Boolean).join('') + '</div>'
            : ''

          return '<div class="bookmark-card">' +
            '<div class="bookmark-header">' +
              '<div class="avatar">' + avatar + '</div>' +
              '<div class="author-info">' +
                '<h3>' + authorName + '</h3>' +
                '<span>' + (bookmark.authorHandle || '') + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="bookmark-text">' + (bookmark.text || '<em>No text content</em>') + '</div>' +
            mediaHtml +
            '<div class="bookmark-footer">' +
              '<a href="' + bookmark.url + '" target="_blank" rel="noreferrer">View on X -></a>' +
              '<div class="footer-right">' +
                mediaIndicator +
                '<span class="status-badge status-' + bookmark.status + '">' + bookmark.status + '</span>' +
              '</div>' +
            '</div>' +
          '</div>'
        }).join('')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        renderLoadError(message)
      }
    }
    loadBookmarks()
    setInterval(loadBookmarks, 30000) // Refresh every 30s
  </script>
</body>
</html>
`
}

