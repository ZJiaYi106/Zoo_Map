# 秦皇岛野生动物园 AI 智能导览 · 微信小程序 + FastAPI 全栈

面向微信开发者工具预览与真机调试，后端提供登录、景点/设施数据、收藏、对话历史及 **AI 智能体（意图 + 知识库检索 + 大模型生成）** 能力，便于在 [Gitee](https://gitee.com) 开源协作。

## 技术栈

| 端 | 技术 |
|----|------|
| 小程序 | 原生微信小程序（`map`、登录、`wx.request`、本地缓存） |
| 后端 | Python 3.11 + FastAPI + SQLAlchemy + PyMySQL + Redis + JWT |
| AI | OpenAI 兼容 Chat Completions；无 Key 时自动 **演示模式（Mock）**；RAG 知识库为关键词检索增强 |
| 部署 | Docker / Docker Compose；生产见 [docs/腾讯云部署指南.md](docs/腾讯云部署指南.md) |

## 功能说明

- **首页**：景区简介、地图导航 / AI 导览 / 景点推荐 / 设施查询入口、「我的」。
- **地图**：园区中心坐标、标注点、定位、AI 路线入口、设施查询入口、底部详情弹窗。
- **登录**：`wx.login` 换 code，后端 `code2session`（可 `MOCK_WX_LOGIN`），JWT + Redis 缓存。
- **AI 导览**：路线规划 / 问答 / 打卡建议等；快捷按钮；对话本地缓存；可选 TTS 音频 URL 播放。
- **景点**：分类筛选、列表、AI 讲解、收藏（后端 + 本地）。
- **设施**：分类列表、跳转地图并定位。
- **我的**：收藏入口、历史对话入口、关于、退出登录。

## 目录结构

```
LittleApp/                 # 微信开发者工具打开此目录
├── app.js / app.json / app.wxss
├── pages/                 # 各页面
├── utils/request.js       # 统一请求
├── images/                # 可选：banner.jpg 等
├── docs/项目初始化说明.md
├── docs/腾讯云部署指南.md       # 配置片段（Nginx/systemd）
├── docs/腾讯云小白部署步骤.md   # 从零一步步：域名→服务器→备案→HTTPS→小程序
├── backend/               # FastAPI
│   ├── main.py
│   └── app/
├── sql/init.sql           # MySQL 建表与示例数据
├── Dockerfile
├── docker-compose.yml
├── DEBUG.md               # 调试与常见问题
└── README.md
```

## 快速开始

### 1. 微信小程序

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. **导入项目**，目录选本仓库根目录；测试可使用 **测试号**；不要勾选云开发。
3. **详情 → 本地设置**：勾选 **不校验合法域名**（仅开发联调）。
4. 修改 `app.js` 中 `globalData.apiBase` 为后端地址（真机请使用电脑局域网 IP，如 `http://192.168.1.10:8000`）。
5. 编译预览。

更细步骤见：`docs/项目初始化说明.md`。

### 2. 后端（本地 Python）

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
copy ..\\.env.example .env
# 按需修改 MySQL / Redis / 微信 / LLM；在 MySQL 中执行 ../sql/init.sql
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

若本机 Python/pip 过旧导致依赖编译失败，请优先使用 **Docker Compose** 或升级 **pip** 与 **Python 3.10+** 虚拟环境。

健康检查：<http://127.0.0.1:8000/health>

### 3. Docker Compose（推荐一体化）

在项目根目录：

```bash
docker compose up -d --build
```

默认 API：<http://127.0.0.1:8000>。首次启动 MySQL 初始化脚本会导入示例数据。

### 4. 大模型（可选）

在 `backend/.env` 中配置：

- `LLM_API_BASE`：OpenAI 兼容地址（如官方、通义、DeepSeek 网关等）。
- `LLM_API_KEY`、`LLM_MODEL`。
- 未配置且 `ALLOW_MOCK_LLM=true` 时，接口返回内置演示文案，便于无 Key 联调 UI。

### 5. 微信小程序上线

- 在微信公众平台配置 **request 合法域名**（HTTPS）。
- 配置 **业务域名**（若使用 web-view）。
- 关闭「不校验合法域名」，使用正式 HTTPS 后端。

## 接口说明（节选）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/wx-login` | body: `{ "code": "wx.login 返回" }` |
| POST | `/api/ai/chat` | Header: `Authorization: Bearer <token>`，body: `content`, `demand_type` |
| POST | `/api/ai/scenic-explain` | 景点 AI 讲解 |
| GET | `/api/scenic/list` | `category`、`page`、`page_size` |
| GET | `/api/facility/list` | `type`（厕所/超市/观景台/休息区） |
| POST | `/api/collection/toggle` | 收藏/取消 |
| GET | `/api/collection/list` | 我的收藏 |
| GET | `/api/chat/history` | 对话历史 |
| DELETE | `/api/chat/history/{id}` | 删除一条历史 |

统一响应形态：`{ "code": 0, "message": "ok", "data": ... }`（业务错误时 `code` 非 0）。

## 截图占位

将预览截图保存为 `docs/screenshots/home.png` 等后，可在本 README 中引用：

```markdown
![首页](docs/screenshots/home.png)
```

（仓库内不强制包含图片文件，便于轻量克隆。）

## 开源与协议

- 推荐托管至 **Gitee**：新建仓库 → 推送本目录代码。
- 内容仅供学习演示；景区信息以官方现场公告为准。

## 许可

MIT License（可按团队需要再调整）。
