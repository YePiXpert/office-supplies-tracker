# 办公用品采购系统

用于内部办公用品采购、台账维护、执行跟踪、报表统计和备份恢复的单用户工具。

当前版本：`1.2.19`

详细页面操作、字段说明和常见问题见 [`USAGE.md`](./USAGE.md)。

## 核心能力

- 上传 PDF 或图片后自动提取流水号、部门、经办人、日期和物品明细
- 支持 `local` 与 `cloud` 两类 OCR/视觉解析模式
- 台账支持筛选、分页、在线编辑、批量修改和批量删除
- 执行看板支持状态流转
- 支持报表、审计日志、回收站、数据质检
- 支持本地备份和 WebDAV 云备份/恢复
- 支持 Windows 桌面版、便携版和安装包发布

## 快速开始

### 源码运行

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
./start.sh
```

访问：`http://localhost:8000`

### Windows 桌面运行

- 直接双击 `start_windows.bat`
- 或运行 `python desktop.py`

### 获取安装包

- 直接从 GitHub Releases 下载最新 `office-supplies-portable.exe`
- 或下载 `office-supplies-setup.exe`

## 最近更新

### v1.2.12

- 前端第三方依赖已内置到 `static/vendor/`，不再依赖公网 CDN
- Windows 安装包和便携版可以离线打开前端界面
- 版本号统一从根目录 `VERSION` 读取
- 新增 `/api/app/metadata`，前端启动时读取版本和 Gemini 运行元数据
- Gemini 默认模型统一由 `gemini_config.py` 中的 `DEFAULT_GEMINI_MODEL_NAME` 定义
- README 精简，详细说明迁移到 `USAGE.md`

### v1.2.11

- 修复 Windows 构建链路中的回归校验输出问题
- 自动发布链路恢复正常

### v1.2.6

- 引入本地管理员密码、恢复码、Cookie 会话和锁定策略

## 技术栈

- 后端：FastAPI + SQLite + SQLAlchemy + Alembic
- 文档解析：pdfplumber + PaddleOCR
- 前端：Vue 3 + TailwindCSS + Axios
- 桌面容器：pywebview
- 导出：openpyxl

## 运行与配置说明

### 版本来源

- 根目录 `VERSION` 是唯一版本来源
- 后端通过 `app_metadata.py` 读取版本
- 前端通过 `/api/app/metadata` 显示版本号

### Gemini 默认配置

- 默认模型常量在 `gemini_config.py`
- Google 协议下未手动填写模型名时，会使用后端统一默认值

### 离线运行

- `Vue`、`Tailwind`、`Axios` 已内置到 `static/vendor/`
- 不再依赖 `jsdelivr`、`cdn.tailwindcss.com`、Google Fonts

## 常用接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/app/metadata` | 获取应用版本与 Gemini 运行元数据 |
| GET | `/api/items` | 获取台账列表 |
| POST | `/api/upload-ocr` | 上传并创建解析任务 |
| GET | `/api/tasks/{task_id}` | 查询解析任务状态 |
| POST | `/api/import/confirm` | 确认导入 |
| GET | `/api/backup` | 下载本地备份 |
| POST | `/api/restore` | 上传备份并恢复 |
| GET | `/api/webdav/backups` | 列出 WebDAV 备份 |
| POST | `/api/webdav/backup` | 上传备份到 WebDAV |
| POST | `/api/webdav/restore` | 从 WebDAV 恢复 |

## 相关文档

- 使用说明：[`USAGE.md`](./USAGE.md)
- 回归样例：`samples/regression/`
- 构建脚本：`scripts/`
