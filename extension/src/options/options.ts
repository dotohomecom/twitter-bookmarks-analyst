// Options page script
import { Settings, MessageType } from '../types'

const DEFAULT_SETTINGS: Settings = {
  serverUrl: 'http://localhost:3000',
  enabled: true,
}

// DOM elements
const serverUrlInput = document.getElementById('serverUrl') as HTMLInputElement
const enabledCheckbox = document.getElementById('enabled') as HTMLInputElement
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement
const testBtn = document.getElementById('testBtn') as HTMLButtonElement
const statusDiv = document.getElementById('status') as HTMLDivElement
const totalBookmarksSpan = document.getElementById('totalBookmarks') as HTMLSpanElement
const pendingSyncSpan = document.getElementById('pendingSync') as HTMLSpanElement

// Load settings on page load
async function loadSettings(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: MessageType.GET_SETTINGS })
    const settings: Settings = response?.settings || DEFAULT_SETTINGS
    
    serverUrlInput.value = settings.serverUrl
    enabledCheckbox.checked = settings.enabled
  } catch (error) {
    console.error('Failed to load settings:', error)
    serverUrlInput.value = DEFAULT_SETTINGS.serverUrl
    enabledCheckbox.checked = DEFAULT_SETTINGS.enabled
  }
}

// Save settings
async function saveSettings(): Promise<void> {
  const settings: Settings = {
    serverUrl: serverUrlInput.value.trim() || DEFAULT_SETTINGS.serverUrl,
    enabled: enabledCheckbox.checked,
  }
  
  try {
    await chrome.runtime.sendMessage({
      type: MessageType.SAVE_SETTINGS,
      data: settings,
    })
    
    showStatus('Settings saved successfully!', 'success')
  } catch (error) {
    console.error('Failed to save settings:', error)
    showStatus('Failed to save settings', 'error')
  }
}

// Test server connection
async function testConnection(): Promise<void> {
  const serverUrl = serverUrlInput.value.trim()
  
  if (!serverUrl) {
    showStatus('Please enter a server URL', 'error')
    return
  }
  
  testBtn.disabled = true
  testBtn.textContent = 'Testing...'
  
  try {
    const response = await fetch(`${serverUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (response.ok) {
      const data = await response.json()
      showStatus(`Connected! Server version: ${data.version || 'unknown'}`, 'success')
    } else {
      showStatus(`Server returned error: ${response.status}`, 'error')
    }
  } catch (error) {
    showStatus(`Connection failed: ${(error as Error).message}`, 'error')
  } finally {
    testBtn.disabled = false
    testBtn.textContent = 'Test Connection'
  }
}

// Load statistics
async function loadStats(): Promise<void> {
  try {
    // Get pending sync count from local storage
    const result = await chrome.storage.local.get('retryQueue')
    const queue = result.retryQueue || []
    pendingSyncSpan.textContent = queue.length.toString()
    
    // Try to get total count from server
    const settings = await chrome.storage.sync.get('settings')
    const serverUrl = settings.settings?.serverUrl || DEFAULT_SETTINGS.serverUrl
    
    try {
      const response = await fetch(`${serverUrl}/api/bookmarks/count`)
      if (response.ok) {
        const data = await response.json()
        totalBookmarksSpan.textContent = data.count?.toString() || '0'
      }
    } catch {
      // Server not available, that's ok
      totalBookmarksSpan.textContent = '-'
    }
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

// Show status message
function showStatus(message: string, type: 'success' | 'error'): void {
  statusDiv.textContent = message
  statusDiv.className = `status ${type}`
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    statusDiv.className = 'status'
  }, 5000)
}

// Event listeners
saveBtn.addEventListener('click', saveSettings)
testBtn.addEventListener('click', testConnection)

// Initialize
loadSettings()
loadStats()
