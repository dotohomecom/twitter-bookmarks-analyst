// Popup script for Twitter Bookmarks extension settings
const API_BASE = 'http://localhost:3001'
const MESSAGE_TIMEOUT_MS = 3000

const mediaDirInput = document.getElementById('mediaDir')
const saveBtn = document.getElementById('saveBtn')
const browseBtn = document.getElementById('browseBtn')
const serverStatus = document.getElementById('serverStatus')
const todayCount = document.getElementById('todayCount')
const totalCount = document.getElementById('totalCount')
const messageEl = document.getElementById('message')

document.addEventListener('DOMContentLoaded', () => {
  void init()
})

async function init() {
  if (!hasRequiredElements()) {
    console.error('Popup UI elements are missing')
    return
  }

  saveBtn.addEventListener('click', () => {
    void handleSave()
  })

  browseBtn.addEventListener('click', () => {
    void handleBrowse()
  })

  await loadConfig()
  await checkServerStatus()
}

function hasRequiredElements() {
  return (
    mediaDirInput &&
    saveBtn &&
    browseBtn &&
    serverStatus &&
    todayCount &&
    totalCount &&
    messageEl
  )
}

async function loadConfig() {
  try {
    const response = await fetch(API_BASE + '/api/config')
    const data = await parseJsonSafely(response)

    if (!response.ok || !data) {
      return
    }

    if (typeof data.mediaDir === 'string' && data.mediaDir.trim().length > 0) {
      mediaDirInput.value = data.mediaDir
    }
  } catch (error) {
    console.error('Failed to load config:', error)
  }
}

async function checkServerStatus() {
  try {
    const response = await fetch(API_BASE + '/api/config')
    const data = await parseJsonSafely(response)

    if (!response.ok || !data) {
      setDisconnected()
      return
    }

    serverStatus.textContent = 'Connected'
    serverStatus.className = 'status-value status-connected'
    todayCount.textContent = String(data.todayCount ?? '-')
    totalCount.textContent = String(data.totalCount ?? '-')
  } catch (_error) {
    setDisconnected()
  }
}

function setDisconnected() {
  serverStatus.textContent = 'Disconnected'
  serverStatus.className = 'status-value status-disconnected'
  todayCount.textContent = '-'
  totalCount.textContent = '-'
}

async function handleBrowse() {
  const originalLabel = browseBtn.textContent
  browseBtn.disabled = true
  browseBtn.textContent = 'Browsing...'

  try {
    const response = await fetch(API_BASE + '/api/config/browse-media-dir', {
      method: 'POST',
    })

    const data = await parseJsonSafely(response)

    if (!response.ok || !data || data.success !== true) {
      if (data && data.cancelled) {
        showMessage('Directory selection cancelled.', 'info')
        return
      }

      const errorMessage = data && data.error ? data.error : 'Failed to open directory picker.'
      showMessage(errorMessage, 'error')
      return
    }

    if (typeof data.mediaDir === 'string' && data.mediaDir.trim().length > 0) {
      mediaDirInput.value = data.mediaDir
      showMessage('Directory selected. Click Save to apply.', 'success')
      return
    }

    showMessage('Directory selection returned an empty path.', 'error')
  } catch (_error) {
    showMessage('Unable to connect to server.', 'error')
  } finally {
    browseBtn.disabled = false
    browseBtn.textContent = originalLabel
  }
}

async function handleSave() {
  const mediaDir = mediaDirInput.value.trim()

  if (!mediaDir) {
    showMessage('Please enter a media directory path.', 'error')
    return
  }

  const originalLabel = saveBtn.textContent
  saveBtn.disabled = true
  saveBtn.textContent = 'Saving...'

  try {
    const response = await fetch(API_BASE + '/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaDir }),
    })

    const data = await parseJsonSafely(response)

    if (!response.ok || !data || data.success !== true) {
      const errorMessage = data && data.error ? data.error : 'Failed to save configuration.'
      showMessage(errorMessage, 'error')
      return
    }

    showMessage('Saved successfully.', 'success')
    await checkServerStatus()
  } catch (_error) {
    showMessage('Unable to connect to server.', 'error')
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = originalLabel
  }
}

function showMessage(text, type) {
  messageEl.textContent = text
  messageEl.className = 'message ' + type

  setTimeout(() => {
    messageEl.className = 'message'
  }, MESSAGE_TIMEOUT_MS)
}

async function parseJsonSafely(response) {
  try {
    return await response.json()
  } catch (_error) {
    return null
  }
}
