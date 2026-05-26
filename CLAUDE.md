# QuillForge — Claude Code 指南

## 项目概述

QuillForge 是一个面向网文作者的 AI 辅助写作桌面应用，使用 **Tauri 2.x** (Rust 后端) + **Vue 3** (TypeScript) 构建。支持多 LLM 提供商（OpenAI、Anthropic、Ollama、OpenAI Compatible），所有数据本地存储，API Key 经 AES-256-GCM 加密。

## 项目结构

```
├── src/                          # Vue 3 + TypeScript 前端
│   ├── components/
│   │   ├── ai/                   # AI 面板组件 (AiPanel, ReviewResult, IdeaResult, ContinueResult, ConsistencyResult, GenChapterResult, TemplateSelector)
│   │   ├── analytics/            # 写作分析面板
│   │   ├── common/               # 通用组件 (AppLayout, TitleBar, LoadingDots, ModalDialog, SearchDialog)
│   │   ├── editor/               # 编辑器组件 (NovelEditor, BubbleMenu, BookSidebar, BookSettingsPanel, CharacterPanel, EditorToolbar, ChapterHistory)
│   │   └── settings/             # 设置组件 (SettingsDialog, ProviderCard, ApiKeyInput)
│   ├── stores/                   # Pinia 状态管理
│   │   ├── book.ts               # 书籍/章节/角色 CRUD + 自动保存
│   │   ├── editor.ts             # 编辑器内容、选区、AI 结果、加载/取消状态
│   │   ├── settings.ts           # LLM 提供商/预设配置 + API Key 管理
│   │   ├── theme.ts              # 亮色/暗色主题切换
│   │   ├── i18n.ts               # 语言偏好持久化
│   │   └── templates.ts          # 提示词模板管理
│   ├── extensions/               # TipTap 自定义扩展
│   │   ├── ghost-text.ts         # AI 续写的幽灵文本 (GhostText) 扩展
│   │   └── spellcheck.ts         # 拼写检查扩展 (SpellCheck, 红色波浪线标错)
│   ├── i18n/
│   │   ├── index.ts              # vue-i18n 配置
│   │   └── locales/
│   │       ├── zh-CN.ts          # 简体中文语言包
│   │       └── en-US.ts          # 英文语言包
│   ├── types/                    # TypeScript 类型定义
│   │   └── index.ts              # Message, ModelConfig, Book, Chapter, Character 等
│   ├── App.vue                   # 根组件
│   ├── main.ts                   # 入口：挂载 Pinia + i18n + theme
│   └── style.css                 # 全局样式 + CSS 变量主题系统
│
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── lib.rs                # Tauri 应用入口，注册命令和插件
│   │   ├── main.rs               # 桌面入口
│   │   ├── commands/             # Tauri 命令实现（按领域拆分）
│   │   │   ├── mod.rs            # 模块声明 + 重新导出
│   │   │   ├── ai.rs             # AI 消息 & 连接检测
│   │   │   ├── keys.rs           # API Key CRUD
│   │   │   ├── books.rs          # 书籍持久化 & 导出
│   │   │   ├── history.rs        # 版本快照（文件系统存储，备选方案）
│   │   │   ├── search.rs         # 全文搜索 (Tantivy)
│   │   │   ├── spell.rs          # 拼写检查 (Hunspell)
│   │   │   └── helpers.rs        # 内部辅助函数
│   │   ├── crypto.rs             # AES-256-GCM 加密/解密
│   │   └── llm/
│   │       ├── mod.rs            # LLM 模块声明
│   │       ├── provider.rs       # 提供商路由 + ProviderInfo 定义
│   │       ├── openai.rs         # OpenAI API 实现
│   │       ├── anthropic.rs      # Anthropic API 实现
│   │       ├── ollama.rs         # Ollama API 实现
│   │       └── openai_compat.rs  # OpenAI Compatible API 实现
│   ├── tauri.conf.json           # Tauri 窗口/构建/安全配置
│   ├── capabilities/default.json # 窗口权限配置
│   └── Cargo.toml                # Rust 依赖
│
├── index.html                    # Vite 入口 HTML
├── vite.config.ts                # Vite 配置 (端口 1420, @ 别名)
├── tsconfig.json                 # TypeScript 项目引用配置
├── tsconfig.app.json             # 前端 TS 配置
├── tsconfig.node.json            # Node TS 配置
└── package.json                  # 前端依赖和脚本
```

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Tauri 2.x |
| 前端框架 | Vue 3 + TypeScript + Vite |
| 状态管理 | Pinia (Composition API) |
| 富文本编辑器 | TipTap (ProseMirror) |
| 国际化 | vue-i18n (legacy: false) |
| 后端 | Rust (reqwest, tokio, aes-gcm) |

## 关键约定

### 编码风格
- **前端**: Vue 3 Composition API + `<script setup lang="ts">`，CSS scoped
- **状态管理**: Pinia `defineStore` 组合式 API (`() => { ... }` 模式)
- **后端**: Rust async/await，通过 `invoke` 桥接
- **命名**: camelCase (JS/TS)，snake_case (Rust)
- **类型**: 前端类型定义集中在 `src/types/index.ts`，Rust 端用 `#[derive(Serialize, Deserialize)]` 镜像

### 前端-后端通信
- 前端命令封装在 `src/commands/` 下按领域拆分（`ai.ts`、`keys.ts`、`storage.ts`）
- Rust 命令在 `src-tauri/src/commands/` 下按领域拆分（`ai.rs`、`keys.rs`、`books.rs`）
- 所有命令在 `lib.rs` 的 `invoke_handler` 中注册
- 前后端共享数据结构 (ModelConfig, AiRequest, ProviderInfo 等)

### 数据流
### 数据流
- **AI 请求**: 前端 -> `commands/ai.ts:sendAiMessage()` -> `invoke('send_ai_message')` -> `commands/ai.rs` -> `llm/provider.rs` -> 具体提供商实现
- **API Key**: 前端 -> `commands/keys.ts:saveApiKey()` -> `invoke('save_api_key')` -> `commands/keys.rs` -> `crypto.rs` -> Tauri 加密存储
- **书籍持久化**: Pinia store `watch` 深度监听 -> 800ms 防抖自动保存 -> `invoke('save_all_books')` -> 写入用户数据目录
- **版本快照**: 内存存储，嵌入 `Chapter.snapshots` 数组，通过书籍持久化机制自动保存到 JSON

### 状态管理
- `bookStore`: 核心数据，管理书籍/章节/角色的增删改查，包含 `activeChapterId`；`deep: true` watch + 快照比对实现自动保存
- `editorStore`: 编辑器实时状态（内容、选区、AI 加载状态、取消支持、action handler 注册），`wordCount` 为计算属性
- `settingsStore`: LLM 提供商预设配置、API Key 状态，预设存 `localStorage`
- `themeStore`: 亮/暗主题切换，应用 CSS 变量
- `i18nStore`: 语言偏好持久化
- `templatesStore`: 提示词模板的 CRUD、按功能/标签筛选、导入/导出

### 主题系统
- 使用 CSS 变量 (`--color-bg`, `--color-surface`, `--color-text`, `--color-accent` 等)
- `data-theme="light"` / `data-theme="dark"` 属性切换
- 默认跟随系统偏好

### 国际化
- 语言文件在 `src/i18n/locales/`，支持 `zh-CN` 和 `en-US`
- 模板中使用 `$t('key')` 或 `t('key')` (Composition API)
- 默认语言: `zh-CN`

## 常用命令

```bash
npm run dev          # 启动 Vite 开发服务器（端口 1420）
npm run build        # TypeScript 检查 + Vite 构建
npm run tauri dev    # 启动完整 Tauri 开发环境
npm run tauri build  # 生产构建
```

## 开发指南

### 添加新功能
1. 前端类型 → `src/types/index.ts`
2. Rust 端类型 → 相应文件添加 `#[derive(Serialize, Deserialize)]`
3. Tauri 命令 → 按照领域在 `src-tauri/src/commands/` 下对应文件中实现 + `lib.rs` 的 `invoke_handler` 注册
4. 前端命令封装 → 按照领域在 `src/commands/` 下对应文件中封装
5. Pinia Store / 组件 → 按功能添加到 `src/stores/` 或 `src/components/`

### 添加新的 AI 提供商
1. `src-tauri/src/llm/provider.rs` 的 `send_to_provider()` 添加路由分支
2. `src-tauri/src/llm/` 下创建新文件实现 API 调用
3. `provider.rs` 的 `get_providers()` 添加 `ProviderInfo`
4. 前端 `src/i18n/locales/` 可添加提供商名称翻译

### 主窗口布局
```
┌─────────────┬──────────────────────────────┬────────────┐
│  TitleBar (自定义标题栏，无系统边框)       │
├─────────────┬──────────────────────────────┬────────────┤
│             │  EditorToolbar               │            │
│ BookSidebar │  NovelEditor (TipTap +       │  AiPanel   │
│  240px      │    BubbleMenu浮动工具栏)     │  320px     │
│             │  flex: 1                     │            │
└─────────────┴──────────────────────────────┴────────────┘
```

### 编辑器 (NovelEditor)
- 基于 TipTap (ProseMirror)，扩展包括: StarterKit, Underline, Highlight, TextAlign, Placeholder, GhostText, SpellCheck
- **BubbleMenu**: 选中文本时弹出的浮动格式化工具栏（粗体、斜体、下划线、删除线、高亮、标题、分隔线）
- **专注模式**: 点击 ⚡ 切换，淡化 header、收窄编辑区，减少视觉干扰
- **阅读时间**: 自动估算显示 ~X min
- **排版**: 衬线字体 (Georgia/Noto Serif SC)、宽松行距 1.9、细滚动条
- **拼写检查**: 红色波浪线标错 (Hunspell 后端)，600ms 防抖
- **Ghost Text**: AI 续写提示，Tab 接受 · Esc 取消

### 错误反馈
- AI 操作失败的错误通过 `editorStore.setError()` 设置
- `AppLayout` 组件监听 `editorStore.error`，显示底部的全局 Toast（8秒自动消失，点击可关闭）
- AI 面板组件（ReviewResult、IdeaResult、ContinueResult）也各自显示错误

### 自动保存
- 书籍数据通过 `bookStore` 的 `watch(books, ..., { deep: true })` 自动保存
- 800ms 防抖，数据通过 `invoke('save_all_books')` 写入 Rust 后端
- Rust 端使用 `app_data_dir` 存储 JSON 文件

### 安全
- API Key 仅通过 Rust 后端加密存储，前端只获取掩码状态
- 所有 LLM HTTP 请求经 Rust 层代理，Key 不暴露给前端网络层
- 窗口使用 `decorations: false`（自定义标题栏）
- CSP: null（由后端控制安全策略）
