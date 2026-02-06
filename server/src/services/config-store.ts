// Config store service - persists user configuration to JSON file
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { logger } from '../utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const CONFIG_FILE = join(DATA_DIR, 'config.json')

export interface UserConfig {
  mediaDir: string
  updatedAt: string
}

const DEFAULT_CONFIG: UserConfig = {
  mediaDir: '',
  updatedAt: new Date().toISOString(),
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
    logger.info({ path: DATA_DIR }, 'Created data directory')
  }
}

export function loadConfig(): UserConfig {
  ensureDataDir()
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = readFileSync(CONFIG_FILE, 'utf-8')
      const config = JSON.parse(data) as UserConfig
      logger.debug({ config }, 'Loaded config from file')
      return { ...DEFAULT_CONFIG, ...config }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to load config, using defaults')
  }
  return { ...DEFAULT_CONFIG }
}

export function saveConfig(config: Partial<UserConfig>): UserConfig {
  ensureDataDir()
  const currentConfig = loadConfig()
  const newConfig: UserConfig = {
    ...currentConfig,
    ...config,
    updatedAt: new Date().toISOString(),
  }
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8')
    logger.info({ mediaDir: newConfig.mediaDir }, 'Config saved')
  } catch (error) {
    logger.error({ error }, 'Failed to save config')
    throw error
  }
  return newConfig
}

export function getMediaDir(): string {
  const config = loadConfig()
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const dateStr = year + '-' + month + '-' + day
  
  let baseDir: string
  if (config.mediaDir && config.mediaDir.trim()) {
    baseDir = config.mediaDir.trim()
  } else {
    baseDir = join(__dirname, '..', '..', 'media')
  }
  return join(baseDir, dateStr)
}

export function getBaseMediaDir(): string {
  const config = loadConfig()
  if (config.mediaDir && config.mediaDir.trim()) {
    return config.mediaDir.trim()
  }
  return join(__dirname, '..', '..', 'media')
}
