// Build script to copy static files to dist
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const distDir = resolve(rootDir, 'dist')

// Ensure dist exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true })
}

// Copy manifest.json
const manifest = {
  manifest_version: 3,
  name: "Twitter Bookmarks Analyst",
  version: "1.0.0",
  description: "Automatically collect and save Twitter/X bookmarks to your server",
  permissions: ["storage", "alarms"],
  host_permissions: [
    "*://x.com/*",
    "*://twitter.com/*",
    "http://localhost:3001/*",
    "http://127.0.0.1:3001/*"
  ],
  background: {
    service_worker: "background.js",
    type: "module"
  },
  content_scripts: [{
    matches: ["*://x.com/*", "*://twitter.com/*"],
    js: ["content.js"],
    run_at: "document_idle"
  }],
  options_page: "options.html",
  action: {
    default_title: "Twitter Bookmarks Analyst"
  }
}

writeFileSync(
  resolve(distDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
)
console.log('✓ Created manifest.json')

// Copy options.html
const optionsHtml = readFileSync(resolve(rootDir, 'src/options/options.html'), 'utf-8')
writeFileSync(resolve(distDir, 'options.html'), optionsHtml)
console.log('✓ Copied options.html')

// Copy options.js
const optionsJs = readFileSync(resolve(rootDir, 'src/options/options.js'), 'utf-8')
writeFileSync(resolve(distDir, 'options.js'), optionsJs)
console.log('✓ Copied options.js')

// Copy icons
const iconsDir = resolve(distDir, 'icons')
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true })
}

const iconSrc = resolve(rootDir, 'public/icons/icon.svg')
if (existsSync(iconSrc)) {
  copyFileSync(iconSrc, resolve(iconsDir, 'icon.svg'))
  console.log('✓ Copied icon.svg')
}

console.log('\n✅ Build completed! Load the "dist" folder in Chrome.')
