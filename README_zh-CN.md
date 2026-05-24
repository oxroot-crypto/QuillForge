<p align="center">
  <img src="src-tauri/icons/icon.svg" alt="QuillForge" width="128" height="128" />
</p>

<h1 align="center">QuillForge</h1>

<p align="center">
  <strong>AI 驱动的网文创作助手</strong>
</p>

<p align="center">
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/vue-3.x-brightgreen.svg" alt="Vue 3" /></a>
  <a href="https://v2.tauri.app"><img src="https://img.shields.io/badge/tauri-2.x-orange.svg" alt="Tauri 2" /></a>
  <a href="https://www.rust-lang.org"><img src="https://img.shields.io/badge/rust-1.70%2B-red.svg" alt="Rust" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/typescript-5.x-3178c6.svg" alt="TypeScript" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> | <strong>简体中文</strong>
</p>

---

QuillForge 是一款面向网文作者的桌面端写作工具，将富文本编辑器与 AI 辅助写作能力深度融合。支持多家 LLM 提供商（OpenAI、Anthropic、Ollama 以及 OpenAI 兼容接口），所有数据本地存储，凭据加密保护，并借鉴现代代码编辑器的内联幽灵文本补全交互。

## ✨ 功能

<table>
  <tr>
    <td width="50%">
      <h4>📚 书籍与章节管理</h4>
      <p>层级组织：书籍 → 章节，每本书独立配置世界观、剧情总结、角色档案，自动作为 AI 上下文。</p>
    </td>
    <td width="50%">
      <h4>🔍 AI 审阅</h4>
      <p>选中文本一键审阅，从文法、节奏、角色一致性、情节逻辑等维度给出具体建议。</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>💡 灵感构思</h4>
      <p>描述当前情节节点或卡点，AI 结合已有世界观和角色给出 3–5 个创意发展方向。</p>
    </td>
    <td>
      <h4>✍️ 内联幽灵文本续写</h4>
      <p>AI 续写内容以幽灵文本形式直接出现在编辑器光标处。<kbd>Tab</kbd> 接受，<kbd>Esc</kbd> 取消——类似 IDE 代码补全。</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>📖 AI 生成章节</h4>
      <p>一键生成完整章节，侧边栏显示生成中动画。AI 根据世界观、剧情总结和已有章节脉络自动续写。</p>
    </td>
    <td>
      <h4>📝 剧情总结自动生成</h4>
      <p>逐章分析情节，提炼连贯的故事总结。AI 遍历所有章节，以前文总结为上下文保证连续性。</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>🔌 多提供商支持</h4>
      <p>OpenAI · Anthropic · Ollama · OpenAI 兼容（DeepSeek、Qwen、豆包等）。每个提供商独立记住模型名和 API 地址，切换时不丢配置。保存为命名预设，工具栏快速切换。</p>
    </td>
    <td>
      <h4>🌍 国际化 & 🎨 主题</h4>
      <p>简体中文 / English 实时切换。亮色 / 暗色一键切换，默认跟随系统。</p>
    </td>
  </tr>
</table>

## 🛡️ 安全

- API Key 使用 **AES-256-GCM** 加密，存储在 Tauri 安全存储中
- 密钥不出 Rust 后端——前端仅知悉是否已配置
- 所有 LLM HTTP 请求均由 Rust 层代理

## 🏗️ 技术栈

| 层 | 技术 |
|-------|-------|
| 桌面壳 | [Tauri 2.x](https://v2.tauri.app) |
| 前端 | [Vue 3](https://vuejs.org) + [TypeScript](https://www.typescriptlang.org) + [Vite](https://vitejs.dev) |
| 状态管理 | [Pinia](https://pinia.vuejs.org) |
| 编辑器 | [TipTap](https://tiptap.dev) (ProseMirror) |
| 国际化 | [vue-i18n](https://vue-i18n.intlify.dev) |
| 后端 | Rust — [reqwest](https://docs.rs/reqwest), [tokio](https://tokio.rs), [aes-gcm](https://docs.rs/aes-gcm) |

## 🚀 快速开始

### 前置条件

- **Node.js** ≥ 18
- **Rust** ≥ 1.70
- 各平台 [Tauri 依赖](https://v2.tauri.app/start/prerequisites/)

```bash
# 安装依赖
npm install

# 启动开发
npm run tauri dev

# 生产构建
npm run tauri build
```

## 📁 项目结构

```
├── src/                          # Vue 3 前端
│   ├── components/
│   │   ├── ai/                   # ReviewResult, IdeaResult, ContinueResult, AiPanel, AiLoadingState
│   │   ├── common/               # AppLayout, TitleBar, LoadingDots, ModalDialog
│   │   ├── editor/               # NovelEditor, BookSidebar, BookSettingsPanel, CharacterPanel
│   │   └── settings/             # SettingsDialog, ProviderCard, ApiKeyInput
│   ├── stores/                   # Pinia (book, editor, settings, theme, i18n)
│   ├── commands/                 # Tauri invoke 封装
│   ├── extensions/               # TipTap GhostText 扩展
│   ├── i18n/locales/             # zh-CN, en-US
│   └── types/                    # TypeScript 类型定义
│
├── src-tauri/                    # Rust 后端
│   └── src/
│       ├── commands.rs           # Tauri 命令 (AI、持久化、导出)
│       ├── crypto.rs             # AES-256-GCM 加解密
│       └── llm/                  # 各提供商实现 (OpenAI, Anthropic, Ollama, compat)
│
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 📄 许可证

MIT © 2026 [oxroot](https://github.com/oxroot-crypto) & Claude

---

<p align="center">
  <sub>由 oxroot 和 Claude 倾心打造 ❤️</sub>
</p>
