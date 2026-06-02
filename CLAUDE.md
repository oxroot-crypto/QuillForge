# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# QuillForge — Claude Code 指南

## 项目概述

QuillForge 是一个面向网文作者的 AI 辅助写作桌面应用，使用 **Tauri 2.x** (Rust 后端) + **Vue 3** (TypeScript) 构建。支持多 LLM 提供商（OpenAI、Anthropic、Ollama、OpenAI Compatible），所有数据本地存储，API Key 经 AES-256-GCM 加密。

## 常用命令

```bash
npm install                    # 安装前端依赖
npx tauri dev                  # 启动完整 Tauri 开发环境（Vite 端口 1420）
npx tauri build                # 生产构建
npm run build                  # vue-tsc 类型检查 + Vite 生产构建
npm run dev                    # 仅启动 Vite 开发服务器
npx vue-tsc --noEmit           # 仅 TypeScript 类型检查（无构建）
```

## 项目结构

```
src/                           # Vue 3 + TypeScript 前端
├── agents/                    # AI Agent 系统（工具调用模式）
│   ├── engine.ts              # Agent 执行引擎（消息循环 + 工具路由）
│   ├── tools.ts               # 工具定义（read_chapter, edit_chapter 等 12 个工具）
│   └── types.ts               # AgentTool, AgentMessage, ToolParam 类型
├── components/
│   ├── ai/                    # AI 面板 + 各 action 结果组件
│   ├── analytics/             # 写作分析面板（句子长度分布、对话比等）
│   ├── common/                # 通用组件（AppLayout, TitleBar, ModalDialog, SearchDialog, CreateBookDialog, OutlineDialog）
│   ├── editor/                # 编辑器（NovelEditor, BubbleMenu, BookSidebar, EditorToolbar, AgentsCli 等）
│   └── settings/              # 设置（SettingsDialog, ProviderCard, ApiKeyInput）
├── stores/                    # Pinia 状态（book, editor, settings, theme, i18n, templates）
├── commands/                  # Tauri invoke 封装（ai, keys, storage, history, search）
├── extensions/                # TipTap 自定义扩展（ghost-text, spellcheck）
├── i18n/locales/              # zh-CN.ts, en-US.ts
├── utils/                     # 共享工具函数
│   └── content.ts             # countWords() / stripHtml() — 中英文混排字数统计
└── types/index.ts             # 所有前端类型定义

src-tauri/                     # Rust 后端
├── src/
│   ├── lib.rs                 # 入口，register 命令和插件
│   ├── commands/              # Tauri 命令（ai, keys, books, history, search, spell, helpers）
│   ├── crypto.rs              # AES-256-GCM 加密解密
│   └── llm/                   # LLM 提供商（provider, openai, anthropic, ollama, openai_compat）
└── tauri.conf.json
```

## 关键架构模式

### Tauri 命令桥接

前后端通信通过 `invoke()`，前端在 `src/commands/` 封装，后端在 `src-tauri/src/commands/` 实现，`lib.rs` 的 `invoke_handler` 注册。所有 Rust 命令返回 `Result<T, String>`。

### 数据持久化

- **书籍数据**: `app_data_dir/books.json`，Pinia store watch(deep: true) + 800ms 防抖自动保存
- **用户预设**: `localStorage`
- **API Keys**: Tauri 加密存储 + AES-256-GCM，前端只通过 `get_api_key_status` 获取掩码状态
- **每日统计**: `localStorage`（高频写入，独立持久化）
- **版本快照**: 嵌入 `Chapter.snapshots` 数组，随书籍 JSON 一同持久化

### AI Action 架构

前端 `AiAction` 类型定义 6 种（`review | idea | continue | consistency | gen_chapter | rewrite`），Rust 端额外处理 4 种内部 action（`gen_outline | gen_plot_summary | gen_setting | gen_character`）。系统提示词在 Rust 端硬编码，用户模板的 `systemPrompt` 作为额外要求拼接。

### AI Agent 系统（`src/agents/`）

基于工具调用的 Agent 架构：
- `engine.ts`: 消息循环，将用户输入 → LLM → 工具调用 → 观察结果 → 继续/终止
- `tools.ts`: 12 个工具（read_chapter, edit_chapter, append_chapter, create_chapter, rename_chapter, read_chapters_list, read_selection, read_book_info, read_stats, add_character, update_character, delete_character, update_world_setting, update_story_setting）
- 通过 `AgentsCli.vue` 组件交互，类似 CLI 界面

### Ghost Text 续写

AI 续写的内容以幽灵文本形式在编辑器中实时显示（ProseMirror Decoration）：
- 按 `Tab` 接受并插入
- 按 `Esc` 取消
- `editorStore.cursorPosition` 决定续写位置，无光标时默认文尾

### 字数统计（`src/utils/content.ts`）

`countWords(html)` 正确处理中英文混排：CJK 字符每个算 1 字，英文按空格分词后算 token 数。项目中所有字数统计统一调用此函数。

### 提供商运行时路由

`llm/provider.rs:send_to_provider()` 根据 `model_config.provider` 路由到对应实现。

## 编码约定

### 前端
- Vue 3 Composition API: `<script setup lang="ts">` + CSS scoped
- Pinia: `defineStore('name', () => { ... })` 组合式模式
- 命名: camelCase，类型集中在 `src/types/index.ts`
- 组件通信: 父组件 `v-if` 控制 + `@close` 事件，使用 `Teleport to="body"` 实现模态
- 快捷键注册在 `AppLayout.vue` 的 `onKeydown` 中（Ctrl+Shift+ 组合键）

### Rust
- async/await，snake_case
- `#[derive(Serialize, Deserialize)]` 镜像前端类型
- `#[tauri::command]` 返回值: `Result<T, String>`

## 国际化

两个语言包 `zh-CN.ts` / `en-US.ts`，默认 `zh-CN`。模板中通过 `$t('key')` 或 `t('key')` 使用。添加新键时必须同时更新两个文件，保持键路径一致。

## 写操作的副作用

- **续写 (continue)**: 依赖 `cursorPosition`，通过 ghost text 预览，手动确认后插入
- **改写 (rewrite)**: 自动保存快照 → 替换全部内容，可通过快照恢复
- **生成章节 (gen_chapter)**: 替换当前选中章节的全部内容
- **审阅应用 (doApplyReview)**: 将 AI 审阅意见发回 LLM → 生成修改版 → 自动应用 + 保存快照
- 所有写操作在 `finally` 中调用 `focusEditor()` 恢复编辑器焦点

## 常用开发操作

### 添加新 AI Action
1. `src/types/index.ts` → AiAction 联合类型加新值
2. `src-tauri/src/commands/ai.rs` → build_messages() 和 get_default_system_prompt() 加分支
3. 创建前端结果组件 → `AiPanel.vue` 注册标签页
4. `TemplateSelector.vue` 更新 action 下拉
5. 两个语言包添加对应键

### 添加新 AI 提供商
1. `llm/provider.rs` → send_to_provider() 加路由
2. `llm/` 下创建新文件实现 API 调用
3. `get_providers()` 添加 ProviderInfo
4. 语言包加提供商名称翻译

### 添加新 Agent 工具
1. `src/agents/tools.ts` 的 `createTools()` 中添加工具定义（name, description, parameters, execute）
2. 若需新增 context 方法，先在 `ToolContext` 接口声明，再到 `AgentsCli.vue` 的 context 对象中实现

### 添加新 i18n 键
同时在 `zh-CN.ts` 和 `en-US.ts` 中添加，保持键路径一致。

## 重要注意事项

- API Key 仅在 Rust 端处理，前端只获取掩码状态
- 所有 LLM HTTP 请求经 Rust 层代理，Key 不暴露给前端
- `chapterStatus`: `'draft' | 'revising' | 'completed' | 'frozen'`，默认 `'draft'`
- 所有 AI 按钮在无活跃章节时禁用
- AI 取消机制: `editorStore.cancelAction()` + `isCancelled()` 按 action 维度取消
- `@` 别名映射到 `./src`
- 主题 CSS 变量在 `src/style.css` 的 `:root` 和 `[data-theme="dark"]` 中定义
