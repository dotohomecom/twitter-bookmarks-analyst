// DOM utility functions for finding and interacting with X.com elements

/**
 * Find all bookmark buttons on the page
 * X.com uses data-testid for stable element identification
 */
export function findBookmarkButtons(): HTMLElement[] {
  // Primary selector: data-testid
  const buttons = document.querySelectorAll('[data-testid="bookmark"]')
  
  if (buttons.length > 0) {
    return Array.from(buttons) as HTMLElement[]
  }
  
  // Fallback: aria-label based selection
  const ariaButtons = document.querySelectorAll('[aria-label*="Bookmark"], [aria-label*="bookmark"], [aria-label*="书签"], [aria-label*="加入书签"]')
  
  return Array.from(ariaButtons) as HTMLElement[]
}

/**
 * Check if a bookmark button is currently in "bookmarked" state
 */
export function isBookmarked(button: HTMLElement): boolean {
  // Check aria-label for state indication
  const ariaLabel = button.getAttribute('aria-label') || ''
  
  // "Remove from Bookmarks" indicates it's bookmarked
  // "Bookmark" indicates it's not bookmarked
  if (ariaLabel.toLowerCase().includes('remove') || 
      ariaLabel.includes('取消') ||
      ariaLabel.includes('移除')) {
    return true
  }
  
  // Check for filled bookmark icon (SVG path changes)
  const svg = button.querySelector('svg')
  if (svg) {
    // Filled bookmark typically has a different path
    const path = svg.querySelector('path')
    if (path) {
      const d = path.getAttribute('d') || ''
      // Filled bookmark path is typically shorter and has different commands
      // This is a heuristic - X may change this
      if (d.includes('M4 4.5') && d.includes('V21')) {
        return true
      }
    }
  }
  
  // Check for color change (bookmarked items often have colored icons)
  const colorElement = button.querySelector('[style*="color: rgb(29, 155, 240)"]') ||
                       button.querySelector('[style*="color: rgb(249, 24, 128)"]')
  if (colorElement) {
    return true
  }
  
  return false
}

/**
 * Get the tweet article element containing the button
 */
export function getTweetArticle(element: HTMLElement): HTMLElement | null {
  // Walk up the DOM to find the article element
  let current: HTMLElement | null = element
  
  while (current && current !== document.body) {
    if (current.tagName === 'ARTICLE') {
      return current
    }
    // Also check for data-testid="tweet"
    if (current.getAttribute('data-testid') === 'tweet') {
      return current
    }
    current = current.parentElement
  }
  
  return null
}

/**
 * Extract tweet URL from article
 */
export function extractTweetUrl(article: HTMLElement): string | null {
  // Look for the permanent link to the tweet
  // Usually in a time element's parent anchor
  const timeElement = article.querySelector('time')
  if (timeElement) {
    const link = timeElement.closest('a')
    if (link) {
      const href = link.getAttribute('href')
      if (href && href.includes('/status/')) {
        return `https://x.com${href}`
      }
    }
  }
  
  // Fallback: look for links containing /status/
  const statusLinks = article.querySelectorAll('a[href*="/status/"]')
  for (const link of statusLinks) {
    const href = link.getAttribute('href')
    if (href && /\/status\/\d+/.test(href)) {
      return `https://x.com${href}`
    }
  }
  
  return null
}

/**
 * Extract tweet ID from URL
 */
export function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/)
  return match ? match[1] : null
}

/**
 * Extract author information from article
 */
export function extractAuthorInfo(article: HTMLElement): { 
  authorId: string
  authorName: string
  authorHandle: string 
} | null {
  // Find user avatar link which contains username
  const userLinks = article.querySelectorAll('a[href^="/"]')
  
  for (const link of userLinks) {
    const href = link.getAttribute('href')
    if (href && !href.includes('/status/') && !href.includes('/photo/') && 
        !href.includes('/video/') && href.match(/^\/[a-zA-Z0-9_]+$/)) {
      
      const handle = href.slice(1) // Remove leading /
      
      // Try to find display name
      // Usually in a span near the handle
      const parentCell = link.closest('[data-testid="User-Name"]') || 
                         link.closest('[data-testid="UserName"]')
      
      let displayName = handle
      if (parentCell) {
        const nameSpan = parentCell.querySelector('span')
        if (nameSpan && nameSpan.textContent) {
          displayName = nameSpan.textContent.trim()
        }
      }
      
      return {
        authorId: handle,
        authorName: displayName,
        authorHandle: `@${handle}`,
      }
    }
  }
  
  return null
}

/**
 * Extract tweet text content
 */
export function extractTweetText(article: HTMLElement): string {
  // Primary: data-testid="tweetText"
  const tweetTextElement = article.querySelector('[data-testid="tweetText"]')
  
  if (tweetTextElement) {
    return tweetTextElement.textContent?.trim() || ''
  }
  
  // Fallback: look for the main text div
  const textDivs = article.querySelectorAll('[lang]')
  for (const div of textDivs) {
    const text = div.textContent?.trim()
    if (text && text.length > 0) {
      return text
    }
  }
  
  return ''
}

/**
 * Extract media URLs and type from article
 */
export function extractMediaInfo(article: HTMLElement): {
  mediaType: 'none' | 'image' | 'video' | 'gif' | 'mixed'
  mediaUrls: string[]
} {
  const mediaUrls: string[] = []
  let hasImage = false
  let hasVideo = false
  let hasGif = false
  
  // Find images
  const images = article.querySelectorAll('img[src*="pbs.twimg.com/media"]')
  for (const img of images) {
    const src = img.getAttribute('src')
    if (src) {
      // Convert to original quality
      const originalUrl = src.replace(/\?.*$/, '?format=jpg&name=orig')
                             .replace(/&name=\w+/, '&name=orig')
      mediaUrls.push(originalUrl)
      hasImage = true
    }
  }
  
  // Find videos
  const videos = article.querySelectorAll('video')
  for (const video of videos) {
    const src = video.getAttribute('src')
    const poster = video.getAttribute('poster')
    
    if (src) {
      mediaUrls.push(src)
    } else if (poster) {
      // Video might be blob, store poster for reference
      mediaUrls.push(poster)
    }
    
    // Check if it's a GIF
    const parent = video.closest('[data-testid="tweetPhoto"]')
    if (parent?.querySelector('[aria-label*="GIF"]')) {
      hasGif = true
    } else {
      hasVideo = true
    }
  }
  
  // Find video thumbnails (for videos that haven't loaded)
  const videoThumbnails = article.querySelectorAll('[data-testid="videoPlayer"]')
  if (videoThumbnails.length > 0 && !hasVideo) {
    hasVideo = true
    // Store the tweet URL - server will download via yt-dlp
  }
  
  // Determine media type
  let mediaType: 'none' | 'image' | 'video' | 'gif' | 'mixed' = 'none'
  
  if (hasImage && (hasVideo || hasGif)) {
    mediaType = 'mixed'
  } else if (hasGif) {
    mediaType = 'gif'
  } else if (hasVideo) {
    mediaType = 'video'
  } else if (hasImage) {
    mediaType = 'image'
  }
  
  return { mediaType, mediaUrls }
}

/**
 * Extract quoted tweet URL if present
 */
export function extractQuotedTweetUrl(article: HTMLElement): string | null {
  // Quoted tweets are nested, find inner links
  const quotedTweet = article.querySelector('[data-testid="quoteTweet"]') ||
                      article.querySelector('[role="link"][tabindex="0"]')
  
  if (quotedTweet) {
    const link = quotedTweet.querySelector('a[href*="/status/"]')
    if (link) {
      const href = link.getAttribute('href')
      if (href) {
        return `https://x.com${href}`
      }
    }
  }
  
  return null
}
