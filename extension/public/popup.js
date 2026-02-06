// Popup script for Twitter Bookmarks extension settings
const API_BASE = 'http://localhost:3001'

const mediaDirInput = document.getElementById('mediaDir')
const saveBtn = document.getElementById('saveBtn')
const serverStatus = document.getElementById('serverStatus')
const todayCount = document.getElementById('todayCount')
const totalCount = document.getElementById('totalCount')
const messageEl = document.getElementById('message')

document.addEventListener('DOMContentLoaded', init)

async function init() {
  await loadConfig()
  await checkServerStatus()
}

async function loadConfig() {
  try {
    const response = await fetch(API_BASE + '/api/config')
    if (response.ok) {
      const data = await response.json()
      if (data.mediaDir) {
        mediaDirInput.value = data.mediaDir
      }
    }
  } catch (error) {
    console.error('Failed to load config:', error)
  }
}

async function checkServerStatus() {
  try {
    const response = await fetch(API_BASE + '/api/config')
    if (response.ok) {
      const data = await response.json()
      serverStatus.textContent = '✓ 已连接'
      serverStatus.className = 'status-value status-connected'
      todayCount.textContent = data.todayCount ?? '-'
      totalCount.textContent = data.totalCount ?? '-'
    } else {
      setDisconnected()
    }
  } catch (error) {
    setDisconnected()
  }
}

function setDisconnected() {
  serverStatus.textContent = '✗ 未连接'
  serverStatus.className = 'status-value status-disconnected'
  todayCount.textContent = '-'
  totalCount.textContent = '-'
}

saveBtn.addEventListener('click', async () => {
  const mediaDir = mediaDirInput.value.trim()
  if (!mediaDir) {
    showMessage('请输入存储路径', 'error')
    return
  }
  saveBtn.disabled = true
  saveBtn.textContent = '保存中...'
  try {
    const response = await fetch(API_BASE + '/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaDir }),
    })
    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        showMessage('✓ 保存成功', 'success')
      } else {
        showMessage(data.error || '保存失败', 'error')
      }
    } else {
      const data = await response.json().catch(() => ({}))
      showMessage(data.error || '服务器错误', 'error')
    }
  } catch (error) {
    showMessage('无法连接服务器', 'error')
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = '保存'
  }
})

function showMessage(text, type) {
  messageEl.textContent = text
  messageEl.className = 'message ' + type
  setTimeout(() => { messageEl.className = 'message' }, 3000)
}
