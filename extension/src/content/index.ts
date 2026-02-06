// Content Script - Runs on X.com pages
// Monitors bookmark button clicks and extracts tweet data

interface TweetData {
  tweetId: string
  url: string
  authorId: string
  authorName: string
  authorHandle: string
  text: string
  mediaType: 'none' | 'image' | 'video' | 'gif' | 'mixed'
  mediaUrls: string[]
  quotedTweetUrl?: string
  bookmarkTime: string
  rawHtml?: string
}

const MessageType = {
  BOOKMARK_ADDED: 'BOOKMARK_ADDED',
} as const

const processedTweets = new Set<string>()
let scanTimeout: ReturnType<typeof setTimeout> | null = null

function init(): void {
  console.log('[Content] Twitter Bookmarks Analyst content script loaded')
  setupObserver()
  setTimeout(scanForBookmarkButtons, 1000)
}

function setupObserver(): void {
  const observer = new MutationObserver(() => {
    if (scanTimeout) clearTimeout(scanTimeout)
    scanTimeout = setTimeout(scanForBookmarkButtons, 300)
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

function findBookmarkButtons(): HTMLElement[] {
  const buttons = document.querySelectorAll('[data-testid="bookmark"]')
  return Array.from(buttons) as HTMLElement[]
}

function getTweetArticle(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element
  while (current && current !== document.body) {
    if (current.tagName === 'ARTICLE') return current
    if (current.getAttribute('data-testid') === 'tweet') return current
    current = current.parentElement
  }
  return null
}

function extractTweetUrl(article: HTMLElement): string | null {
  const timeElement = article.querySelector('time')
  if (timeElement) {
    const link = timeElement.closest('a')
    if (link) {
      const href = link.getAttribute('href')
      if (href && href.includes('/status/')) {
        return 'https://x.com' + href
      }
    }
  }
  const statusLinks = article.querySelectorAll('a[href*="/status/"]')
  for (const link of statusLinks) {
    const href = link.getAttribute('href')
    if (href && /\/status\/\d+/.test(href)) {
      return 'https://x.com' + href
    }
  }
  return null
}

function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/)
  return match ? match[1] : null
}

function extractAuthorInfo(article: HTMLElement): { authorId: string; authorName: string; authorHandle: string } | null {
  const userLinks = article.querySelectorAll('a[href^="/"]')
  for (const link of userLinks) {
    const href = link.getAttribute('href')
    if (href && !href.includes('/status/') && !href.includes('/photo/') && !href.includes('/video/') && href.match(/^\/[a-zA-Z0-9_]+$/)) {
      const handle = href.slice(1)
      const parentCell = link.closest('[data-testid="User-Name"]') || link.closest('[data-testid="UserName"]')
      let displayName = handle
      if (parentCell) {
        const nameSpan = parentCell.querySelector('span')
        if (nameSpan?.textContent) {
          displayName = nameSpan.textContent.trim()
        }
      }
      return { authorId: handle, authorName: displayName, authorHandle: '@' + handle }
    }
  }
  return null
}

function extractTweetText(article: HTMLElement): string {
  const tweetTextElement = article.querySelector('[data-testid="tweetText"]')
  if (tweetTextElement) return tweetTextElement.textContent?.trim() || ''
  const textDivs = article.querySelectorAll('[lang]')
  for (const div of textDivs) {
    const text = div.textContent?.trim()
    if (text && text.length > 0) return text
  }
  return ''
}

function extractMediaInfo(article: HTMLElement): { mediaType: 'none' | 'image' | 'video' | 'gif' | 'mixed'; mediaUrls: string[] } {
  const mediaUrls: string[] = []
  let hasImage = false
  let hasVideo = false
  const images = article.querySelectorAll('img[src*="pbs.twimg.com/media"]')
  for (const img of images) {
    const src = img.getAttribute('src')
    if (src) {
      const originalUrl = src.replace(/&name=\w+/, '&name=orig')
      mediaUrls.push(originalUrl)
      hasImage = true
    }
  }
  const videos = article.querySelectorAll('video')
  if (videos.length > 0) hasVideo = true
  const videoPlayers = article.querySelectorAll('[data-testid="videoPlayer"]')
  if (videoPlayers.length > 0) hasVideo = true
  let mediaType: 'none' | 'image' | 'video' | 'gif' | 'mixed' = 'none'
  if (hasImage && hasVideo) mediaType = 'mixed'
  else if (hasVideo) mediaType = 'video'
  else if (hasImage) mediaType = 'image'
  return { mediaType, mediaUrls }
}

function extractTweetData(article: HTMLElement): TweetData | null {
  try {
    const url = extractTweetUrl(article)
    if (!url) return null
    const tweetId = extractTweetId(url)
    if (!tweetId) return null
    const authorInfo = extractAuthorInfo(article)
    if (!authorInfo) return null
    const text = extractTweetText(article)
    const { mediaType, mediaUrls } = extractMediaInfo(article)
    return {
      tweetId, url,
      authorId: authorInfo.authorId,
      authorName: authorInfo.authorName,
      authorHandle: authorInfo.authorHandle,
      text, mediaType, mediaUrls,
      bookmarkTime: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[Content] Error extracting tweet data:', error)
    return null
  }
}

function scanForBookmarkButtons(): void {
  const buttons = findBookmarkButtons()
  buttons.forEach((button) => {
    if (button.dataset.bookmarkListenerAttached) return
    button.dataset.bookmarkListenerAttached = 'true'
    button.addEventListener('click', handleBookmarkClick)
  })
}

async function handleBookmarkClick(event: Event): Promise<void> {
  const button = event.currentTarget as HTMLElement
  const tweetArticle = getTweetArticle(button)
  if (!tweetArticle) {
    console.log('[Content] Could not find tweet article')
    return
  }
  const tweetData = extractTweetData(tweetArticle)
  if (!tweetData) {
    console.log('[Content] Could not extract tweet data')
    return
  }
  await new Promise(resolve => setTimeout(resolve, 500))
  const updatedButton = tweetArticle.querySelector('[data-testid="removeBookmark"]')
  if (updatedButton) {
    console.log('[Content] Bookmark added, sending tweet data...', tweetData.tweetId)
    if (processedTweets.has(tweetData.tweetId)) {
      console.log('[Content] Tweet already processed, skipping')
      return
    }
    processedTweets.add(tweetData.tweetId)
    try {
      chrome.runtime.sendMessage({
        type: MessageType.BOOKMARK_ADDED,
        data: tweetData,
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Content] Message error:', chrome.runtime.lastError)
          showNotification('Extension error, please refresh', 'warning')
          return
        }
        if (response?.success) {
          showNotification('Bookmark saved to server!')
        } else {
          showNotification('Saved locally, will sync later', 'warning')
        }
      })
    } catch (error) {
      console.error('[Content] Failed to send message:', error)
    }
  } else {
    console.log('[Content] Bookmark was removed or not added')
  }
}

function showNotification(message: string, type: 'success' | 'warning' = 'success'): void {
  const notification = document.createElement('div')
  notification.textContent = message
  notification.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 20px;background:' + (type === 'success' ? '#17bf63' : '#ffad1f') + ';color:white;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;font-weight:500;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,0.3);'
  document.body.appendChild(notification)
  setTimeout(() => {
    notification.style.opacity = '0'
    notification.style.transition = 'opacity 0.3s'
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}

init()
