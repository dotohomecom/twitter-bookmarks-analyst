// Build script to copy static files to dist
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const distDir = resolve(rootDir, 'dist')

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true })
}

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
    default_title: "Twitter Bookmarks Analyst",
    default_popup: "popup.html",
    default_icon: { "16": "icon.svg", "48": "icon.svg", "128": "icon.svg" }
  },
  icons: { "16": "icon.svg", "48": "icon.svg", "128": "icon.svg" }
}

writeFileSync(resolve(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log('✓ Created manifest.json')

const optionsHtml = readFileSync(resolve(rootDir, 'src/options/options.html'), 'utf-8')
writeFileSync(resolve(distDir, 'options.html'), optionsHtml)
console.log('✓ Copied options.html')

const optionsJs = readFileSync(resolve(rootDir, 'src/options/options.js'), 'utf-8')
writeFileSync(resolve(distDir, 'options.js'), optionsJs)
console.log('✓ Copied options.js')

const popupHtml = readFileSync(resolve(rootDir, 'public/popup.html'), 'utf-8')
writeFileSync(resolve(distDir, 'popup.html'), popupHtml)
console.log('✓ Copied popup.html')

const popupJs = readFileSync(resolve(rootDir, 'public/popup.js'), 'utf-8')
writeFileSync(resolve(distDir, 'popup.js'), popupJs)
console.log('✓ Copied popup.js')

const iconSrc = resolve(rootDir, 'public/icons/icon.svg')
if (existsSync(iconSrc)) {
  copyFileSync(iconSrc, resolve(distDir, 'icon.svg'))
  console.log('✓ Copied icon.svg')
}

console.log('\n✅ Build completed! Load the "dist" folder in Chrome.')
