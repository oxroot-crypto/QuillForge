# 贡献指南

## 编码规范

### TypeScript / Vue 3

- 使用 `<script setup lang="ts">`，CSS `scoped`
- Pinia store 用 Composition API 风格：`defineStore('name', () => { ... })`
- 从 `src/` 目录导入文件一律使用 `@` 别名，禁止相对路径回溯

```typescript
// ✅ 正确
import { useBookStore } from '@/stores/book'
// ❌ 错误
import { useBookStore } from '../../stores/book'
```

- Import 分组排序：Vue 核心 → 第三方库 → `@` 别名 → 同目录相对
- 类型定义集中在 `src/types/index.ts`，不在组件内内联 interface（Props interface 例外）
- 禁用 `any`，无法确定类型时用 `unknown` + type guard

### 代码注释

- 注释使用简体中文，细粒度、详尽
- 每个文件顶部一行概述注释说明核心职责
- 导出函数使用 JSDoc（`@param` / `@returns`）
- 关键逻辑加行内注释说明"为什么这样做"

### Rust

- 命名：snake_case（变量/函数），PascalCase（类型）
- 公开 struct/fn 必须写 `///` 文档注释
- 错误用 `Result<T, String>` 返回，避免 `unwrap()`
- Tauri 命令在 `lib.rs` 的 `invoke_handler` 中注册

### CSS

- 组件样式必须 `scoped`
- 颜色使用 CSS 变量（`var(--color-*)`），禁止硬编码 `#rrggbb`
- 新增语义色先定义变量再使用

### i18n

- 所有用户可见文案用 `$t('key')` 或 `t('key')`，禁止硬编码中英文
- 新增 key 同步添加到 `zh-CN.ts` 和 `en-US.ts`
- 内置模板按语言分别提供

## Git 提交规范

### Conventional Commits

```
<type>(<scope>): <中文简述>

<中文详细说明（可选）>

Co-Authored-By: Claude Code <claude@anthropic.com>
```

type: `feat` | `fix` | `refactor` | `style` | `docs` | `chore` | `perf`

scope: `ai` | `editor` | `sidebar` | `settings` | `storage` | `search` | `spell` | `i18n` | `theme` | `tauri`

### 分支策略

- `master` — 稳定主分支
- `feat/<功能名>` — 功能分支
- `fix/<问题名>` — 修复分支
- `release/vX.Y.Z` — 发布分支

## 开发命令

```bash
npm run dev          # Vite 开发服务器（端口 1420）
npm run build        # TypeScript 类型检查 + Vite 构建
npm run tauri dev    # 完整 Tauri 开发环境
npm run tauri build  # 生产构建
```
