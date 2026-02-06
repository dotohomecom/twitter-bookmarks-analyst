// Tweet data extractor
// Combines DOM utilities to extract complete tweet data

import { TweetData } from '../types'
import {
  extractTweetUrl,
  extractTweetId,
  extractAuthorInfo,
  extractTweetText,
  extractMediaInfo,
  extractQuotedTweetUrl,
} from './dom-utils'

/**
 * Extract complete tweet data from an article element
 */
export function extractTweetData(article: HTMLElement): TweetData | null {
  try {
    // Extract URL first - it's required
    const url = extractTweetUrl(article)
    if (!url) {
      console.warn('[Extractor] Could not extract tweet URL')
      return null
    }
    
    // Extract tweet ID
    const tweetId = extractTweetId(url)
    if (!tweetId) {
      console.warn('[Extractor] Could not extract tweet ID from URL:', url)
      return null
    }
    
    // Extract author info
    const authorInfo = extractAuthorInfo(article)
    if (!authorInfo) {
      console.warn('[Extractor] Could not extract author info')
      return null
    }
    
    // Extract text content
    const text = extractTweetText(article)
    
    // Extract media
    const { mediaType, mediaUrls } = extractMediaInfo(article)
    
    // Extract quoted tweet if present
    const quotedTweetUrl = extractQuotedTweetUrl(article)
    
    // Build tweet data object
    const tweetData: TweetData = {
      tweetId,
      url,
      authorId: authorInfo.authorId,
      authorName: authorInfo.authorName,
      authorHandle: authorInfo.authorHandle,
      text,
      mediaType,
      mediaUrls,
      bookmarkTime: new Date().toISOString(),
    }
    
    // Add optional fields
    if (quotedTweetUrl) {
      tweetData.quotedTweetUrl = quotedTweetUrl
    }
    
    // Store raw HTML for debugging/fallback
    tweetData.rawHtml = article.outerHTML
    
    console.log('[Extractor] Successfully extracted tweet data:', {
      tweetId,
      url,
      author: authorInfo.authorHandle,
      textLength: text.length,
      mediaType,
      mediaCount: mediaUrls.length,
    })
    
    return tweetData
    
  } catch (error) {
    console.error('[Extractor] Error extracting tweet data:', error)
    return null
  }
}

/**
 * Extract tweet data from the current page (for tweet detail pages)
 */
export function extractCurrentPageTweet(): TweetData | null {
  // Check if we're on a tweet detail page
  const url = window.location.href
  if (!url.includes('/status/')) {
    return null
  }
  
  // Find the main tweet article
  const articles = document.querySelectorAll('article[data-testid="tweet"]')
  
  // The first article on a detail page is typically the main tweet
  if (articles.length > 0) {
    return extractTweetData(articles[0] as HTMLElement)
  }
  
  return null
}
