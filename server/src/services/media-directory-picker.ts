// Media directory picker service
import { spawn } from 'child_process'
import { logger } from '../utils/logger.js'

export interface MediaDirectoryBrowseResult {
  success: boolean
  mediaDir?: string
  cancelled?: boolean
  error?: string
}

const CANCEL_MARKER = '__CANCELLED__'

export async function browseMediaDirectory(): Promise<MediaDirectoryBrowseResult> {
  if (process.platform !== 'win32') {
    return {
      success: false,
      error: 'Directory browsing is currently supported on Windows only.',
    }
  }

  try {
    const selectedPath = await browseWindowsDirectory()

    if (!selectedPath) {
      return {
        success: false,
        cancelled: true,
        error: 'Directory selection was cancelled.',
      }
    }

    return {
      success: true,
      mediaDir: selectedPath,
    }
  } catch (error) {
    logger.error({ error }, 'Failed to open Windows directory picker')
    return {
      success: false,
      error: 'Failed to open directory picker. Ensure the server runs in an interactive desktop session.',
    }
  }
}

function browseWindowsDirectory(): Promise<string | null> {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    "$dialog.Description = 'Select media directory'",
    '$dialog.ShowNewFolderButton = $true',
    '$dialog.UseDescriptionForTitle = $true',
    '$result = $dialog.ShowDialog()',
    "if ($result -eq [System.Windows.Forms.DialogResult]::OK -and -not [string]::IsNullOrWhiteSpace($dialog.SelectedPath)) {",
    '  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    '  Write-Output $dialog.SelectedPath',
    '} else {',
    "  Write-Output '" + CANCEL_MARKER + "'",
    '}',
  ].join('; ')

  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-STA', '-Command', script],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: false,
      },
    )

    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code !== 0) {
        const errorMessage = stderr.trim() || 'Directory picker process exited with code ' + code
        reject(new Error(errorMessage))
        return
      }

      const lines = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      const lastLine = lines.length > 0 ? lines[lines.length - 1] : ''

      if (lastLine === CANCEL_MARKER || lastLine.length === 0) {
        resolve(null)
        return
      }

      resolve(lastLine)
    })
  })
}
