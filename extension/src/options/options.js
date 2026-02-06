// Options page script for Twitter Bookmarks Analyst

// Constants
const DEFAULT_SERVER_URL = 'http://localhost:3001';

// DOM elements
const serverUrlInput = document.getElementById('serverUrl');
const enabledCheckbox = document.getElementById('enabled');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const statusDiv = document.getElementById('status');
const totalBookmarksSpan = document.getElementById('totalBookmarks');
const pendingSyncSpan = document.getElementById('pendingSync');

// Load settings on page load
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get('settings');
    const settings = result.settings || { serverUrl: DEFAULT_SERVER_URL, enabled: true };
    
    serverUrlInput.value = settings.serverUrl;
    enabledCheckbox.checked = settings.enabled;
  } catch (error) {
    console.error('Failed to load settings:', error);
    serverUrlInput.value = DEFAULT_SERVER_URL;
    enabledCheckbox.checked = true;
  }
}

// Save settings
async function saveSettings() {
  const settings = {
    serverUrl: serverUrlInput.value.trim() || DEFAULT_SERVER_URL,
    enabled: enabledCheckbox.checked,
  };
  
  try {
    await chrome.storage.sync.set({ settings });
    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus('Failed to save settings', 'error');
  }
}

// Test server connection
async function testConnection() {
  const serverUrl = serverUrlInput.value.trim();
  
  if (!serverUrl) {
    showStatus('Please enter a server URL', 'error');
    return;
  }
  
  testBtn.disabled = true;
  testBtn.textContent = 'Testing...';
  
  try {
    const response = await fetch(`${serverUrl}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (response.ok) {
      const data = await response.json();
      showStatus(`Connected! Server version: ${data.version || 'unknown'}`, 'success');
    } else {
      showStatus(`Server returned error: ${response.status}`, 'error');
    }
  } catch (error) {
    showStatus(`Connection failed: ${error.message}`, 'error');
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = 'Test Connection';
  }
}

// Load statistics
async function loadStats() {
  try {
    // Get pending sync count from local storage
    const result = await chrome.storage.local.get('retryQueue');
    const queue = result.retryQueue || [];
    pendingSyncSpan.textContent = queue.length.toString();
    
    // Try to get total count from server
    const settingsResult = await chrome.storage.sync.get('settings');
    const serverUrl = settingsResult.settings?.serverUrl || DEFAULT_SERVER_URL;
    
    try {
      const response = await fetch(`${serverUrl}/api/bookmarks/count`);
      if (response.ok) {
        const data = await response.json();
        totalBookmarksSpan.textContent = data.count?.toString() || '0';
      }
    } catch {
      totalBookmarksSpan.textContent = '-';
    }
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

// Show status message
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  
  setTimeout(() => {
    statusDiv.className = 'status';
  }, 5000);
}

// Event listeners
saveBtn.addEventListener('click', saveSettings);
testBtn.addEventListener('click', testConnection);

// Initialize
loadSettings();
loadStats();
