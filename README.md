<p align="center">
  <img src="src-tauri/icons/icon.svg" alt="QuillForge" width="128" height="128" />
</p>

<h1 align="center">QuillForge</h1>

<p align="center">
  <strong>AI-Powered Novel Writing Assistant</strong>
</p>

<p align="center">
  <strong>English</strong> | <a href="README_zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/vue-3.x-brightgreen.svg" alt="Vue 3" /></a>
  <a href="https://v2.tauri.app"><img src="https://img.shields.io/badge/tauri-2.x-orange.svg" alt="Tauri 2" /></a>
  <a href="https://www.rust-lang.org"><img src="https://img.shields.io/badge/rust-1.70%2B-red.svg" alt="Rust" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/typescript-5.x-3178c6.svg" alt="TypeScript" /></a>
  <a href="./ROADMAP.md"><img src="https://img.shields.io/badge/version-1.2.0-blueviolet.svg" alt="v1.2.0" /></a>
</p>

---

QuillForge is a desktop application for web novel authors, combining a rich text editor with AI-assisted writing capabilities. It supports multiple LLM providers (OpenAI, Anthropic, Ollama, and OpenAI-compatible APIs), stores all data locally with encrypted credentials, and features an inline ghost-text completion system inspired by modern code editors.

**Latest: v1.2 — AI Rewrite · Outline Dialog · Templates · Snapshots · Writing Goals · Chapter Status**
— AI rewrite with auto-apply, restructured prompt template architecture, snapshot title/delete support, outline management with chapter linking, redesigned create-book wizard, track daily word count progress with streak streaks, color-coded chapter status (draft/revising/completed/frozen) with filtering, and automatic writing time tracking.

## ✨ Features

<table>
  <tr>
    <td width="50%">
      <h4>📚 Book & Chapter Management</h4>
      <p>Hierarchical organization: books → chapters, with per-book world settings, story outlines, and character profiles that serve as AI context.</p>
    </td>
    <td width="50%">
      <h4>🔍 AI Review & Consistency Check</h4>
      <p>Select text and receive grammar, pacing, character consistency, and plot logic feedback with one click.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>💡 Idea Generation</h4>
      <p>Describe your current plot point and get 3–5 creative directions, informed by your book's established world and characters.</p>
    </td>
    <td>
      <h4>✍️ Inline Ghost-Text Continuation</h4>
      <p>AI-generated prose appears as ghost text directly in the editor. <kbd>Tab</kbd> to accept, <kbd>Esc</kbd> to dismiss — just like IDE code completion.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>⚡ AI Chapter Generation</h4>
      <p>Generate full chapters from scratch with length control. Supports regeneration and re-apply without creating duplicate chapters.</p>
    </td>
    <td>
      <h4>🔁 AI Rewrite</h4>
      <p>Rewrite selected text or full chapter with custom instructions. Auto-saves a snapshot before applying, supports regeneration with different styles.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>📋 Outline Management</h4>
      <p>Per-chapter outline with drag-to-reorder, chapter linking, and AI-assisted outline generation. Outline context is fed to AI review & consistency checks.</p>
    </td>
    <td>
      <h4>📚 AI Book Generation</h4>
      <p>Describe your novel idea and AI generates title, description, world setting, and character profiles. Preview and edit before creating.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>📦 Prompt Templates</h4>
      <p>Built-in & custom prompt templates for each AI action. Templates append as style modifiers without overriding output format control. Import/export support.</p>
    </td>
    <td>
      <h4>📸 Version Snapshots</h4>
      <p>Manual & auto snapshots per chapter. Snapshots store title + content. Preview, restore, or delete individual snapshots.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>🌐 Internationalization</h4>
      <p>Chinese (简体中文) and English. Switch on the fly from the toolbar.</p>
    </td>
    <td>
      <h4>🎨 Dark & Light Themes</h4>
      <p>One-click toggle. Follows system preference by default.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>📊 Writing Analytics</h4>
      <p>Sentence length distribution, dialogue ratio, readability score, word frequency, and per-book statistics.</p>
    </td>
    <td>
      <h4>📝 Modern Editor</h4>
      <p>TipTap with bubble menu formatting, focus mode, reading time estimate, spell check, and version snapshots.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>🎯 Writing Goals</h4>
      <p>Set daily word count targets, track progress with a live progress bar, monitor writing streaks (🔥 consecutive days), and automatic session time tracking.</p>
    </td>
    <td>
      <h4>🏷️ Chapter Status</h4>
      <p>Color-coded status tags (<code>Draft</code> · <code>Revising</code> · <code>Completed</code> · <code>Frozen</code>) on each chapter. Filter by status, click to cycle, right-click to reverse.</p>
    </td>
  </tr>
</table>

## 🛡️ Security

- API keys are encrypted with **AES-256-GCM** and stored in the Tauri secure store
- Keys never leave the Rust backend — the frontend only knows whether a key is configured
- All LLM HTTP requests are proxied through the Rust layer

## 🏗️ Tech Stack

| Layer | Stack |
|-------|-------|
| Desktop Shell | [Tauri 2.x](https://v2.tauri.app) |
| Frontend | [Vue 3](https://vuejs.org) + [TypeScript](https://www.typescriptlang.org) + [Vite](https://vitejs.dev) |
| State | [Pinia](https://pinia.vuejs.org) |
| Editor | [TipTap](https://tiptap.dev) (ProseMirror) |
| i18n | [vue-i18n](https://vue-i18n.intlify.dev) |
| Backend | Rust — [reqwest](https://docs.rs/reqwest), [tokio](https://tokio.rs), [aes-gcm](https://docs.rs/aes-gcm) |

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Rust** ≥ 1.70
- Platform-specific [Tauri dependencies](https://v2.tauri.app/start/prerequisites/)

```bash
# Install dependencies
npm install

# Start development
npm run tauri dev

# Production build
npm run tauri build
```

## 📁 Project Structure

```
├── src/                          # Vue 3 frontend
│   ├── components/
│   │   ├── ai/                   # AiPanel, ReviewResult, IdeaResult, ContinueResult, RewriteResult, ConsistencyResult, GenChapterResult, TemplateSelector
│   │   ├── analytics/            # AnalyticsPanel (writing statistics dashboard)
│   │   ├── common/               # AppLayout, TitleBar, LoadingDots, ModalDialog, SearchDialog, CreateBookDialog, OutlineDialog
│   │   ├── editor/               # NovelEditor, BubbleMenu, BookSidebar, ChapterHistory, EditorToolbar, BookSettingsPanel, CharacterPanel
│   │   └── settings/             # SettingsDialog, ProviderCard, ApiKeyInput
│   ├── stores/                   # Pinia (book, editor, settings, template, theme, i18n)
│   ├── commands/                 # Tauri invoke wrappers (by domain)
│   │   ├── ai.ts                 # AI messages & connection check
│   │   ├── history.ts            # Version snapshots (in-memory, persisted with book data)
│   │   ├── keys.ts               # API key management
│   │   ├── search.ts             # Full-text search index & query
│   │   ├── storage.ts            # Persistence, providers, export
│   │   └── index.ts              # Re-exports all commands
│   ├── extensions/               # TipTap extensions (GhostText, SpellCheck)
│   ├── i18n/locales/             # zh-CN, en-US
│   └── types/                    # TypeScript definitions
│
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── commands/             # Tauri commands (by domain)
│       │   ├── mod.rs            # Module declarations & re-exports
│       │   ├── ai.rs             # AI message & connection check
│       │   ├── keys.rs           # API key CRUD
│       │   ├── books.rs          # Book persistence & export
│       │   ├── history.rs        # Version snapshots (filesystem, fallback)
│       │   ├── search.rs         # Full-text search (Tantivy)
│       │   ├── spell.rs          # Spell check (Hunspell)
│       │   └── helpers.rs        # Internal helpers
│       ├── crypto.rs             # AES-256-GCM encrypt/decrypt
│       └── llm/                  # Provider implementations (OpenAI, Anthropic, Ollama, compat)
│
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 📄 License

MIT © 2026 [oxroot](https://github.com/oxroot-crypto) & Claude

---

<p align="center">
  <sub>Built with ❤️ by oxroot & Claude</sub>
</p>
