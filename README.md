# Twitter Bookmarks Analyst

🔖 Chrome 扩展，自动采集 Twitter/X 书签并保存到本地服务器。

## 功能特性

- **自动捕获书签**: 监控 X.com 的书签操作
- **完整数据提取**: 采集推文文字、作者信息、媒体 URL
- **媒体下载**: 自动下载图片和视频 (使用 yt-dlp)
- **离线队列**: 服务器不可用时本地缓存，稍后自动同步
- **可视化面板**: Dashboard 查看已保存的书签

## 项目结构

```
twitter-bookmarks-analyst/
├── extension/          # Chrome 扩展 (Manifest V3)
│   ├── src/
│   │   ├── background/ # Service Worker
│   │   ├── content/    # Content Script (运行在 X.com)
│   │   └── options/    # 设置页面
│   ├── scripts/        # 构建脚本
│   └── public/         # 静态资源
│
├── server/             # 后端服务 (Node.js + Fastify)
│   ├── src/
│   │   ├── api/        # REST API
│   │   ├── db/         # SQLite 数据库
│   │   ├── queue/      # 媒体下载队列
│   │   └── services/   # 业务逻辑
│   └── media/          # 下载的媒体文件
│
├── docs/               # 文档
├── start-server.bat    # Windows 启动脚本
└── start-server.sh     # Mac/Linux 启动脚本
```

## 快速开始

### 前置要求

- Node.js 18+
- npm 或 pnpm
- Chrome 浏览器
- (可选) yt-dlp - 用于下载视频

### 1. 启动后端服务

**Windows:**
```bash
双击 start-server.bat
```

**Mac/Linux:**
```bash
chmod +x start-server.sh
./start-server.sh
```

**或手动启动:**
```bash
cd server
npm install
npm run dev
```

服务启动后访问: http://localhost:3001/dashboard

### 2. 构建 Chrome 扩展

```bash
cd extension
npm install
npm run build
```

### 3. 安装扩展到 Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `extension/dist` 文件夹

### 4. 配置扩展

1. 在扩展页面点击「详情」→「扩展程序选项」
2. 确认服务器地址为 `http://localhost:3001`
3. 点击「Test Connection」测试连接

## 使用方法

1. 打开 https://x.com
2. 浏览推文，点击「书签」按钮
3. 扩展自动采集并发送到服务器
4. 访问 http://localhost:3001/dashboard 查看

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/bookmarks` | 获取书签列表 |
| GET | `/api/bookmarks/:id` | 获取单个书签 |
| POST | `/api/bookmarks` | 创建书签 |
| DELETE | `/api/bookmarks/:id` | 删除书签 |
| GET | `/api/bookmarks/count` | 获取书签数量 |

## 技术栈

### 扩展端
- TypeScript
- Vite
- Chrome Extension Manifest V3

### 服务端
- Node.js + TypeScript
- Fastify
- SQLite (better-sqlite3)
- BullMQ (可选，需 Redis)
- yt-dlp (视频下载)

## 安装 yt-dlp (可选)

用于下载推文中的视频：

**Windows:**
```bash
winget install yt-dlp
```

**Mac:**
```bash
brew install yt-dlp
```

**Linux:**
```bash
pip install yt-dlp
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3001` | 服务端口 |
| `DB_PATH` | `./data/bookmarks.db` | 数据库路径 |
| `MEDIA_DIR` | `./media` | 媒体存储目录 |
| `REDIS_HOST` | `localhost` | Redis 主机 |
| `REDIS_PORT` | `6379` | Redis 端口 |

## License

MIT
