// Environment checker and dependency manager
// Ensures yt-dlp and Deno are properly installed and updated

import { spawn, execSync } from 'child_process'
import { platform } from 'os'
import { logger } from './logger.js'

export interface DependencyStatus {
  ytdlp: boolean
  deno: boolean
  ytdlpVersion?: string
  denoVersion?: string
}

/**
 * Check and setup all required dependencies
 * Called on server startup
 */
export async function setupDependencies(): Promise<DependencyStatus> {
  logger.info('Checking runtime dependencies...')
  
  const status: DependencyStatus = {
    ytdlp: false,
    deno: false,
  }

  // 1. Check and install Deno (required for EJS challenge solver)
  status.deno = await checkAndInstallDeno()
  if (status.deno) {
    status.denoVersion = getDenoVersion()
  }

  // 2. Check and update yt-dlp
  status.ytdlp = await checkAndUpdateYtdlp()
  if (status.ytdlp) {
    status.ytdlpVersion = getYtdlpVersion()
  }

  logger.info({ status }, 'Dependency check completed')
  return status
}

/**
 * Check if Deno is installed, install if not
 */
async function checkAndInstallDeno(): Promise<boolean> {
  // Check if Deno exists
  if (commandExists('deno')) {
    logger.info('Deno is already installed')
    return true
  }

  logger.info('Deno not found, attempting to install...')

  const os = platform()
  
  try {
    if (os === 'win32') {
      // Windows: Use PowerShell to install Deno
      logger.info('Installing Deno on Windows...')
      execSync('powershell -Command "irm https://deno.land/install.ps1 | iex"', {
        stdio: 'inherit',
      })
    } else if (os === 'darwin') {
      // macOS: Use curl installer or Homebrew
      logger.info('Installing Deno on macOS...')
      try {
        execSync('brew install deno', { stdio: 'inherit' })
      } catch {
        // Fallback to curl installer
        execSync('curl -fsSL https://deno.land/install.sh | sh', {
          stdio: 'inherit',
        })
      }
    } else {
      // Linux: Use curl installer
      logger.info('Installing Deno on Linux...')
      execSync('curl -fsSL https://deno.land/install.sh | sh', {
        stdio: 'inherit',
      })
    }

    // Verify installation
    if (commandExists('deno')) {
      logger.info('Deno installed successfully')
      return true
    } else {
      logger.warn('Deno installation completed but command not found. You may need to restart your terminal or add Deno to PATH.')
      return false
    }
  } catch (error) {
    logger.error({ error }, 'Failed to install Deno')
    logger.warn('Please install Deno manually: https://deno.land/#installation')
    return false
  }
}

/**
 * Check if yt-dlp is installed and update it
 */
async function checkAndUpdateYtdlp(): Promise<boolean> {
  // Check if yt-dlp exists
  if (!commandExists('yt-dlp')) {
    logger.warn('yt-dlp not found. Video downloads will be skipped.')
    logger.info('Install yt-dlp:')
    logger.info('  Windows: winget install yt-dlp')
    logger.info('  macOS: brew install yt-dlp')
    logger.info('  Linux: pip install yt-dlp')
    return false
  }

  // Update yt-dlp on startup
  logger.info('Updating yt-dlp to latest version...')
  
  try {
    const updateResult = execSync('yt-dlp -U', {
      encoding: 'utf-8',
      timeout: 60000, // 60 seconds timeout
    })
    
    if (updateResult.includes('up to date') || updateResult.includes('Updated')) {
      logger.info('yt-dlp is up to date')
    } else {
      logger.info({ output: updateResult.trim() }, 'yt-dlp update result')
    }
    
    return true
  } catch (error) {
    // Update failed, but yt-dlp might still work
    logger.warn({ error }, 'Failed to update yt-dlp, continuing with current version')
    return true
  }
}

/**
 * Check if a command exists in PATH
 */
function commandExists(command: string): boolean {
  try {
    const os = platform()
    const checkCmd = os === 'win32' ? `where ${command}` : `which ${command}`
    execSync(checkCmd, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Get yt-dlp version
 */
function getYtdlpVersion(): string | undefined {
  try {
    const version = execSync('yt-dlp --version', { encoding: 'utf-8' })
    return version.trim()
  } catch {
    return undefined
  }
}

/**
 * Get Deno version
 */
function getDenoVersion(): string | undefined {
  try {
    const version = execSync('deno --version', { encoding: 'utf-8' })
    const match = version.match(/deno ([\d.]+)/)
    return match ? match[1] : version.split('\n')[0]
  } catch {
    return undefined
  }
}
