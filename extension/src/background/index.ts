// Background Service Worker
// Handles communication between content script and server

// Types
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

interface Settings {
  serverUrl: string
  enabled: boolean
}

// Message types
const MessageType = {
  BOOKMARK_ADDED: 'BOOKMARK_ADDED',
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
} as const

// Default settings
const DEFAULT_SETTINGS: Settings = {
  serverUrl: 'http://localhost:3000',
  enabled: true,
}

// Get settings from storage
async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get('settings')
  return result.settings || DEFAULT_SETTINGS
}

// Send tweet data to server
async function sendToServer(tweetData: TweetData): Promise<boolean> {
  const settings = await getSettings()
  
  if (!settings.enabled) {
    console.log('[Background] Extension disabled, skipping...')
    return false
  }

  try {
    const response = await fetch(`${settings.serverUrl}/api/bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetData),
    })

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`)
    }

    const result = await response.json()
    console.log('[Background] Tweet saved successfully:', result)
    return true
  } catch (error) {
    console.error('[Background] Failed to send tweet to server:', error)
    // Store in local queue for retry
    await addToRetryQueue(tweetData)
    return false
  }
}

// Add failed request to retry queue
async function addToRetryQueue(tweetData: TweetData): Promise<void> {
  const result = await chrome.storage.local.get('retryQueue')
  const queue: TweetData[] = result.retryQueue || []
  
  // Avoid duplicates
  if (!queue.some(item => item.tweetId === tweetData.tweetId)) {
    queue.push(tweetData)
    await chrome.storage.local.set({ retryQueue: queue })
    console.log('[Background] Added to retry queue, queue size:', queue.length)
  }
}

// Process retry queue
async function processRetryQueue(): Promise<void> {
  const result = await chrome.storage.local.get('retryQueue')
  const queue: TweetData[] = result.retryQueue || []
  
  if (queue.length === 0) return

  console.log('[Background] Processing retry queue, size:', queue.length)
  const settings = await getSettings()
  const remaining: TweetData[] = []

  for (const tweetData of queue) {
    try {
      const response = await fetch(`${settings.serverUrl}/api/bookmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tweetData),
      })

      if (!response.ok) {
        remaining.push(tweetData)
      }
    } catch {
      remaining.push(tweetData)
    }
  }

  await chrome.storage.local.set({ retryQueue: remaining })
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === MessageType.BOOKMARK_ADDED) {
    sendToServer(message.data).then(success => {
      sendResponse({ success })
    })
    return true // Keep channel open for async response
  }

  if (message.type === MessageType.GET_SETTINGS) {
    getSettings().then(settings => {
      sendResponse({ settings })
    })
    return true
  }

  if (message.type === MessageType.SAVE_SETTINGS) {
    chrome.storage.sync.set({ settings: message.data }).then(() => {
      sendResponse({ success: true })
    })
    return true
  }
})

// Retry queue processing - every 5 minutes
chrome.alarms.create('retryQueue', { periodInMinutes: 5 })
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'retryQueue') {
    processRetryQueue()
  }
})

console.log('[Background] Twitter Bookmarks Analyst initialized')
