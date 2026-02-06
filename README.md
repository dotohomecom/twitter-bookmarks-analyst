# Twitter Bookmarks Analyst

🔖 A Chrome extension that automatically collects and saves your Twitter/X bookmarks to a local server for analysis and backup.

## Features

- **Auto-capture bookmarks**: Monitors your bookmark actions on X.com (Twitter)
- **Full data extraction**: Captures tweet text, author info, media URLs, and more
- **Media download**: Automatically downloads images and videos using yt-dlp
- **Offline queue**: Saves bookmarks locally if server is unavailable, syncs later
- **Simple dashboard**: View and manage your saved bookmarks

## Project Structure

```
twitter-bookmarks-analyst/
├── extension/          # Chrome Extension (Manifest V3)
│   ├── src/
│   │   ├── background/ # Service Worker
│   │   ├── content/    # Content Scripts (runs on X.com)
│   │   ├── options/    # Settings page
│   │   └── types/      # TypeScript types
│   └── manifest.json
│
├── server/             # Backend Server (Node.js + Fastify)
│   ├── src/
│   │   ├── api/        # REST API routes
│   │   ├── db/         # SQLite database
│   │   ├── queue/      # Media download queue
│   │   └── services/   # Business logic
│   └── media/          # Downloaded media files
│
└── docs/               # Documentation
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Chrome browser
- (Optional) Redis for production queue
- (Optional) yt-dlp for video downloads

### 1. Install Dependencies

```bash
# Install extension dependencies
cd extension
pnpm install

# Install server dependencies
cd ../server
pnpm install
```

### 2. Start the Server

```bash
cd server
pnpm dev
```

Server runs at `http://localhost:3000`

### 3. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension` folder

### 4. Configure the Extension

1. Click the extension icon in Chrome toolbar
2. Go to Options/Settings
3. Enter your server URL (default: `http://localhost:3000`)
4. Enable auto-sync

## Usage

1. Browse Twitter/X as usual
2. Click the bookmark button on any tweet
3. The extension automatically:
   - Captures tweet data (text, author, media)
   - Sends to your local server
   - Downloads media files

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/bookmarks` | List all bookmarks |
| GET | `/api/bookmarks/:id` | Get single bookmark |
| POST | `/api/bookmarks` | Create bookmark |
| DELETE | `/api/bookmarks/:id` | Delete bookmark |
| GET | `/api/bookmarks/count` | Get bookmark count |

## Configuration

### Extension Settings

- **Server URL**: Your backend server address
- **Auto-sync**: Enable/disable automatic syncing

### Server Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `./data/bookmarks.db` | SQLite database path |
| `MEDIA_DIR` | `./media` | Media storage directory |
| `REDIS_HOST` | `localhost` | Redis host (optional) |
| `REDIS_PORT` | `6379` | Redis port |
| `YTDLP_PATH` | `yt-dlp` | Path to yt-dlp executable |

## Tech Stack

### Extension
- TypeScript
- Vite + CRXJS
- Chrome Extension Manifest V3

### Server
- Node.js + TypeScript
- Fastify (web framework)
- SQLite (database)
- BullMQ (job queue)
- yt-dlp (media download)

## Development

### Extension Development

```bash
cd extension
pnpm dev    # Start dev server with hot reload
pnpm build  # Build for production
```

### Server Development

```bash
cd server
pnpm dev    # Start with hot reload
pnpm build  # Build TypeScript
pnpm start  # Run production build
```

## License

MIT
