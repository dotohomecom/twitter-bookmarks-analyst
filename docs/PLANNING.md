# Twitter Bookmarks Analyst - 项目规划文档

## 📋 项目概述

Chrome 浏览器插件，用于监控 X.com (Twitter) 页面的书签操作，自动采集推文信息并保存到服务器。

---

## 1. 技术栈分析

### A. 浏览器插件端 (Client)
- **核心框架**: Manifest V3 (Google 强制标准)
- **开发语言**: TypeScript
- **构建工具**: Vite + CRXJS
- **关键 API**:
  - `MutationObserver`: 监听 X.com 动态加载的 DOM
  - `chrome.runtime`: 处理后台消息通信
  - `chrome.storage`: 本地数据存储
  - `fetch`: 发送数据到服务器

### B. 服务端 (Server)
- **运行环境**: Node.js
- **Web 框架**: Fastify (高性能)
- **数据库**: SQLite (轻量级)
- **任务队列**: BullMQ
- **媒体下载**: yt-dlp / gallery-dl
- **文件存储**: 本地文件系统

---

## 2. 实现层深度分析

### 难点一：精准捕捉"点击收藏"动作
- **挑战**: X.com 是 React SPA，DOM 高度动态且混淆
- **解决方案**: 
  1. 监听网络层 (拦截 API 请求)
  2. 监听 UI 层 (观察图标状态变化)

### 难点二：数据采集与清洗
- **文本**: 通过 `data-testid` 等稳定属性定位
- **图片**: 提取高清图 URL
- **视频/GIF**: 插件采集 URL，后端调用 yt-dlp 下载

### 难点三：鉴权与反爬
- 插件可传递 Cookie 给后端
- 后端可配置独立爬虫账号

---

## 3. 五阶段实施规划 (v2.0)

### 第一阶段：基础设施搭建

| 任务编号 | 任务内容 |
|----------|----------|
| 1.1 | 初始化插件工程 (Vite + CRXJS + TypeScript) |
| 1.2 | 配置 Manifest V3 权限 (host_permissions, storage, tabs) |
| 1.3 | 创建 Options 页面（配置服务器地址） |
| 1.4 | 搭建后端服务 (Node.js/Fastify) |
| 1.5 | 配置 CORS 中间件 |
| 1.6 | 设计完整数据库 Schema |

**数据库 Schema:**
```sql
Bookmarks:
  - id (PRIMARY KEY)
  - tweet_id (UNIQUE)
  - url
  - author_id
  - author_name
  - text
  - media_type
  - media_paths (JSON)
  - status (pending/downloading/completed/failed)
  - bookmark_time
  - created_at
  - updated_at
```

### 第二阶段：核心触发器开发

| 任务编号 | 任务内容 |
|----------|----------|
| 2.1 | X.com DOM 结构逆向分析 |
| 2.2 | 实现 SPA 路由监听器 |
| 2.3 | 实现 MutationObserver 监听新推文加载 |
| 2.4 | 书签按钮点击捕获 + 状态判断 |
| 2.5 | 实现本地去重机制 |

### 第三阶段：数据提取与传输

| 任务编号 | 任务内容 |
|----------|----------|
| 3.1 | 推文数据解析器 (URL、作者、正文、媒体) |
| 3.2 | 覆盖特殊内容 (长文/Quote Tweet/Thread/投票) |
| 3.3 | Content Script → Background 消息通道 |
| 3.4 | 本地离线队列 (chrome.storage.local) |
| 3.5 | 网络请求 + 自动重试 |

### 第四阶段：后端处理与媒体下载

| 任务编号 | 任务内容 |
|----------|----------|
| 4.1 | 接收 API 开发 + 数据入库 |
| 4.2 | 任务队列系统 (BullMQ) |
| 4.3 | 媒体下载引擎 (yt-dlp) |
| 4.4 | 文件命名与存储规范 |
| 4.5 | 下载完成后更新数据库状态 |

**存储规范:** `/{author_id}/{tweet_id}/media_001.jpg`

### 第五阶段：完善与测试

| 任务编号 | 任务内容 |
|----------|----------|
| 5.1 | 边缘情况测试 (纯文字/多图/视频/GIF/引用/已删除/私密/敏感) |
| 5.2 | 前后端日志系统 |
| 5.3 | 用户反馈机制 (Toast/Badge) |
| 5.4 | 简易 Dashboard |
| 5.5 | 文档编写 |

---

## 4. 风险评估矩阵

| 风险项 | 可能性 | 影响 | 缓解措施 |
|--------|--------|------|----------|
| X.com DOM 结构变更 | 高 | 高 | 多重定位策略 + 快速更新 |
| 视频下载失败率高 | 中 | 中 | yt-dlp 定期更新 + 重试机制 |
| 后端服务宕机 | 中 | 高 | 本地队列缓存 |
| 磁盘空间不足 | 低 | 中 | 存储监控 + 告警 |

---

## 5. 项目结构

```
twitter-bookmarks-analyst/
├── extension/              # Chrome 插件
│   ├── src/
│   │   ├── background/     # Service Worker
│   │   ├── content/        # Content Scripts
│   │   ├── options/        # 设置页面
│   │   └── popup/          # 弹出窗口
│   ├── public/
│   └── manifest.json
│
├── server/                 # 后端服务
│   ├── src/
│   │   ├── api/           # API 路由
│   │   ├── services/      # 业务逻辑
│   │   ├── queue/         # 任务队列
│   │   └── db/            # 数据库
│   └── media/             # 媒体文件存储
│
└── docs/                   # 文档
    └── PLANNING.md
```

---

*文档版本: v2.0*
*创建日期: 2026-02-06*
