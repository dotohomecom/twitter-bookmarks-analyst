// Content Script - Runs on X.com pages
// Monitors bookmark button clicks and extracts tweet data

import { TweetData, MessageType } from '../types'
import { extractTweetData } from './extractor'
import { findBookmarkButtons, isBookmarked, getTweetArticle } from './dom-utils'

// Track processed tweets to avoid duplicates
const processedTweets = new Set<string>()

// Main observer for dynamic content
let mainObserver: MutationObserver | null = null

// Initialize the content script
function init(): void {
  console.log('[Content] Twitter Bookmarks Analyst content script loaded')
  
  // Start observing the page
  setupObserver()
  
  // Handle SPA navigation
  setupNavigationListener()
  
  // Initial scan for bookmark buttons
  scanForBookmarkButtons()
}

// Setup MutationObserver to watch for new tweets
function setupObserver(): void {
  if (mainObserver) {
    mainObserver.disconnect()
  }

  mainObserver = new MutationObserver((mutations) => {
    let shouldScan = false
    
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldScan = true
        break
      }
    }
    
    if (shouldScan) {
      // Debounce scanning
      debounce(scanForBookmarkButtons, 300)()
    }
  })

  // Observe the main content area
  const targetNode = document.body
  mainObserver.observe(targetNode, {
    childList: true,
    subtree: true,
  })
}

// Setup listener for SPA navigation
function setupNavigationListener(): void {
  // Listen for URL changes (SPA navigation)
  let lastUrl = location.href
  
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      console.log('[Content] URL changed, rescanning...')
      setTimeout(scanForBookmarkButtons, 500)
    }
  })

  urlObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

// Scan page for bookmark buttons and attach listeners
function scanForBookmarkButtons(): void {
  const buttons = findBookmarkButtons()
  
  buttons.forEach((button) => {
    // Check if already processed
    if (button.dataset.bookmarkListenerAttached) {
      return
    }
    
    button.dataset.bookmarkListenerAttached = 'true'
    
    button.addEventListener('click', handleBookmarkClick)
  })
}

// Handle bookmark button click
async function handleBookmarkClick(event: Event): Promise<void> {
  const button = event.currentTarget as HTMLElement
  
  // Get the tweet article containing this button
  const tweetArticle = getTweetArticle(button)
  if (!tweetArticle) {
    console.warn('[Content] Could not find tweet article')
    return
  }

  // Check if this is adding or removing bookmark
  const wasBookmarked = isBookmarked(button)
  
  // Wait a moment for the UI to update
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Check new state
  const nowBookmarked = isBookmarked(button)
  
  // Only process if bookmark was added (not removed)
  if (!wasBookmarked && nowBookmarked) {
    console.log('[Content] Bookmark added, extracting tweet data...')
    
    try {
      const tweetData = extractTweetData(tweetArticle)
      
      if (!tweetData) {
        console.warn('[Content] Could not extract tweet data')
        return
      }
      
      // Check for duplicate
      if (processedTweets.has(tweetData.tweetId)) {
        console.log('[Content] Tweet already processed, skipping...')
        return
      }
      
      processedTweets.add(tweetData.tweetId)
      
      // Send to background script
      chrome.runtime.sendMessage({
        type: MessageType.BOOKMARK_ADDED,
        data: tweetData,
      }, (response) => {
        if (response?.success) {
          showNotification('Tweet bookmarked and saved!')
        } else {
          showNotification('Saved locally, will sync later', 'warning')
        }
      })
      
    } catch (error) {
      console.error('[Content] Error extracting tweet data:', error)
    }
  }
}

// Show notification to user
function showNotification(message: string, type: 'success' | 'warning' = 'success'): void {
  const notification = document.createElement('div')
  notification.className = 'tba-notification'
  notification.textContent = message
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#17bf63' : '#ffad1f'};
    color: white;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
  `
  
  document.body.appendChild(notification)
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease'
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}

// Inject CSS for animations
function injectStyles(): void {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100px); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

// Debounce utility
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>
  return ((...args: unknown[]) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }) as T
}

// Start the extension
injectStyles()
init()
