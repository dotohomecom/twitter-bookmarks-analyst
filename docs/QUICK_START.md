# 快速开始指南

## 🚀 一键启动

### Windows 用户
双击运行 `start-server.bat`

### Mac/Linux 用户
```bash
chmod +x start-server.sh
./start-server.sh
```

---

## 📦 手动安装步骤

### 1. 安装后端服务

```bash
cd server
npm install
npm run dev
```

服务器启动后访问: http://localhost:3000/dashboard

### 2. 安装 Chrome 扩展

由于本项目使用 TypeScript，需要先构建扩展：

```bash
cd extension
npm install
npm run build
```

然后在 Chrome 中加载：

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `extension/dist` 文件夹

### 3. 配置扩展

1. 点击 Chrome 工具栏中的扩展图标
2. 右键选择「选项」或在扩展页面点击「详情」→「扩展程序选项」
3. 确认服务器地址为 `http://localhost:3000`
4. 点击「Test Connection」确认连接成功

---

## 🧪 测试使用

1. 打开 https://x.com (Twitter)
2. 浏览任意推文
3. 点击推文下方的「书签」按钮 (Bookmark)
4. 扩展会自动捕获并保存推文信息
5. 访问 http://localhost:3000/dashboard 查看已保存的书签

---

## ⚙️ 可选配置

### 安装 yt-dlp（用于下载视频）

Windows:
```bash
winget install yt-dlp
```

Mac:
```bash
brew install yt-dlp
```

Linux:
```bash
sudo apt install yt-dlp
# 或
pip install yt-dlp
```

### 安装 Redis（用于生产环境队列）

如果不安装 Redis，系统会自动使用内存队列，适合个人使用。

---

## 🔧 常见问题

### Q: 扩展没有反应？
A: 检查 Chrome 开发者工具 Console 是否有错误信息。确保在 x.com 页面上操作。

### Q: 服务器连接失败？
A: 确认服务器正在运行，检查防火墙设置。

### Q: 视频没有下载？
A: 确认已安装 yt-dlp。视频下载是异步的，请在 Dashboard 查看状态。
