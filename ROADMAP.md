# QuillForge 路线图

> 当前版本：v1.2.0 · 更新于 2026-05-28

---

## ✅ v1.2 — AI 改写 + 模板架构 + 大纲/快照增强 + 写作目标 + 章节状态（已完成 · v1.2.0）

### 🔄 AI 改写 (Rewrite)

全新的 AI 改写功能，支持选中文本或全章改写，生成后自动应用。

- 选中文本改写，无选中时操作整章
- 自动保存改写前的快照（可回滚）
- 生成结果自动应用到编辑器，显示"已应用"成功状态
- "重新生成"按钮触发不同风格的二次改写
- 改写输入框支持用户自定义改写要求（如"口语化""增加细节""压缩字数"）
- 携带书籍世界观/剧情总结/角色信息作为上下文

**新增文件**：`src/components/ai/RewriteResult.vue`

### 📦 提示词模板架构重设计

- **系统提示词**：由 Rust 后端按 action 类型控制，确保输出格式正确，用户不可覆盖
- **模板提示词**：用户选择模板后，其 `systemPrompt` 以 `【额外要求】` 形式拼接到发送内容的头部，仅影响风格/技巧
- 内置模板重设计为简洁风格修饰器，不再覆盖系统提示词
- 模板管理弹窗支持按功能/标签筛选、搜索、导入/导出 JSON

### 📸 快照增强

- 快照新增 `title` 字段：保存和恢复时同时保留章节标题和内容
- 支持单条快照删除（`deleteSnapshot` 命令）
- 编辑器内容变化时自动同步快照数据

**改动**：`src/commands/history.ts`、`src/components/editor/ChapterHistory.vue`

### 📋 大纲对话框 (OutlineDialog)

重新设计的大纲管理界面，与章节系统深度联动。

- 大纲项标题从关联章节自动读取（只读），描述可自由编辑
- 每个大纲项可关联一个章节，支持取消关联
- 拖拽排序（通过 `reorderOutline`）
- AI 一键生成大纲内容
- AI 审阅和一致性检查时自动参考章节大纲

**新增文件**：`src/components/common/OutlineDialog.vue`

### 📚 创建书籍对话框 (CreateBookDialog)

新设计的建书向导，支持手动和 AI 两种模式。

- **手动模式**：输入书名即可创建，极速上手
- **AI 生成模式**：描述小说创意 → AI 自动生成书名、简介、世界观、角色列表 → 预览并编辑后创建
- 生成结果预览：可编辑书名/简介/世界观，查看生成的角色
- 支持重新生成

**新增文件**：`src/components/common/CreateBookDialog.vue`

### 🧠 AI 操作全面增强

- **审阅/一致性 (Review/Consistency)**：有选中文本时操作选中内容，无选中时操作整章。提示词中追加大纲遵循度评估
- **续写 (Continue)**：使用 `editorStore.cursorPosition` 取光标前 2000 字符作为上下文，无光标时取文档尾部
- **生成章节 (GenChapter)**：仅对已选中章节操作（无选中时禁用），生成后自动保存快照并替换内容
- **禁用保护**：所有 AI 按钮在无活跃章节时自动禁用
- **统一取消机制**：`editorStore.cancelAction()` + `isCancelled()` 支持按 action 维度取消

### 🎯 写作目标系统

- **每日字数目标**：设定每日目标（默认 2000 字），侧边栏实时进度条
- **连续写作天数**：自动记录 streak（连续 days 带 🔥 标识）
- **写作时长统计**：追踪活跃编辑会话时长（2 分钟无操作暂停）
- **目标推进**：超额完成时进度条变绿色
- **数据独立持久化**：localStorage 存储，不与书籍 JSON 耦合
- **字数增量追踪**：在 `updateChapterContent` 中自动计算写入净增量

### 🏷️ 章节状态标签

- 新增类型 `ChapterStatus = 'draft' | 'revising' | 'completed' | 'frozen'`
- 章节列表显示彩色状态圆点：灰色(草稿) · 琥珀(修改中) · 绿色(已完成) · 蓝色(冻结)
- 点击圆点正向循环状态，右键反向循环
- 章节头部下拉筛选器（全部/草稿/修改中/已完成/冻结）
- 旧数据自动迁移：`loadFromDisk` 中为无 `status` 的章节补默认值 `'draft'`

### 🔧 其他增强

- `NovelEditor.vue` 新增 `onCreate` 回调，注入 editor view 给 GhostText 扩展
- `settingsStore` 新增 `connectionStatus` 字段供 UI 实时展示测试连接结果
- `AiPanel` 新增模板选择条（当前 action 筛选可用模板）
- 所有 AI 组件增加统一的取消按钮和加载状态
- 全局 Toast 错误提示（`AppLayout` 监听 `editorStore.error`，8 秒自动消失）

### 文件改动清单

| 文件 | 改动 |
|---|---|
| `src/types/index.ts` | 新增 `ChapterStatus`、`DailyStats`、`Snapshot.title`、`OutlineItem.chapterId` 等 |
| `src/stores/book.ts` | 新增大纲 CRUD、状态管理、写作目标、字数追踪、旧数据迁移 |
| `src/stores/editor.ts` | 新增 `cursorPosition`、`registerActionHandler`、按 action 取消机制 |
| `src/stores/templates.ts` | 按 action 筛选模板、导入/导出增强 |
| `src/stores/settings.ts` | 新增 `connectionStatus` |
| `src/components/ai/RewriteResult.vue` | **新建** — AI 改写组件 |
| `src/components/common/CreateBookDialog.vue` | **新建** — 建书向导 |
| `src/components/common/OutlineDialog.vue` | **新建** — 大纲管理 |
| `src/components/ai/AiPanel.vue` | 新增模板选择条 |
| `src/components/ai/*Result.vue` | 加载/取消/错误状态统一 |
| `src/components/editor/BookSidebar.vue` | 大纲入口、章节状态、写作目标面板 |
| `src/components/editor/ChapterHistory.vue` | 快照标题支持、单条删除 |
| `src/components/editor/NovelEditor.vue` | 光标追踪、editor view 注入 |
| `src/commands/history.ts` | 快照标题/删除支持 |
| `src/commands/ai.ts` | `AiRequest.context` 支持 |
| `src-tauri/src/commands/ai.rs` | `rewrite`/`gen_outline` action、大纲上下文、消息构造 |
| `src/i18n/locales/zh-CN.ts` + `en-US.ts` | 新增改写/大纲/创建书籍/模板等文案 |

---

## v1.3 — 数据分析 + 快照对比（预计 3-4 天）

### 📊 字数趋势图

将当前静态统计分析升级为带时间维度的趋势视图。

- **过去 7 天 / 30 天写作量柱状图**（Canvas 或 SVG 轻量渲染）
- **章节字数分布图**：全书各章节字数一览
- **总字数里程碑**：到达 1 万 / 5 万 / 10 万 / 50 万时显示成就徽章

**改动范围**：
- `src/stores/book.ts` — 新增 `writingHistory` 时间序列数据
- `src/components/analytics/AnalyticsPanel.vue` — 图表组件
- 纯前端实现，无需 Rust 改动

### 🔄 快照对比视图

两个版本之间的差异可视化。

- 在版本历史中选择两个快照 → 并排或行级 diff
- 绿色 = 新增，红色 = 删除
- 基于 `diff-match-patch` 或 `jsdiff` 实现

**改动范围**：
- 新增 `src/components/editor/VersionDiff.vue`
- 修改 `src/components/editor/ChapterHistory.vue` — 支持多选对比
- i18n 新增文案

---

## v1.4 — 导出 + AI 角色对话（预计 4-5 天）

### 📁 多格式导出

从仅有 Markdown 扩展到网文作者最需要的格式。

| 格式 | 实现方式 | 备注 |
|---|---|---|
| **TXT** | Rust 纯文本拼接 | 简单直接，兼容所有平台 |
| **EPUB** | Rust `epub-builder` crate | 网文投稿主流格式 |
| **PDF** | 前端 `window.print()` 或 Rust `printpdf` | 备选方案 |

- 导出对话框：选择书籍 → 选择格式 → 选择导出路径
- 支持自定义导出选项（是否包含角色设定、是否插入分隔符等）

### 🎭 AI 角色对话模拟

让作者以角色身份与 AI 对话，打磨人物 consistency。

- 在角色管理中选择一个角色
- 输入你想问该角色的问题或场景
- AI 以该角色的语气、知识背景、性格作答
- 可用于测试角色对话风格是否统一、探索角色在特定情境下的反应

**改动范围**：
- 新增 AI Action `character_chat`
- `src-tauri/src/commands/ai.rs` — 新增 system prompt + 消息构造
- 新增 `src/components/ai/CharacterChatResult.vue`
- `AiPanel.vue` 注册新标签页

---

## v1.5 — 编辑器增强（预计 3-4 天）

### ✍️ 细粒度 AI 辅助

在编辑器选中文本的 Bubble Menu（气泡菜单）中增加更多 AI 能力：

| 功能 | 交互方式 | 说明 |
|---|---|---|
| **扩写** | 选中文本 → 点击"扩写" | 把一句话展开成一段丰富描写 |
| **缩写** | 选中文本 → 点击"缩写" | 精简冗长段落，保留核心信息 |
| **生成标题** | 点击生成，AI 分析正文 | 为当前章节自动生成 3 个候选标题 |
| **场景描写** | 输入关键词 → AI 生成 | 快速生成场景/环境/氛围描写片段 |

### ⌨️ 快捷操作

- **`/` 菜单**：输入 `/` 唤起指令菜单（类似 Notion），快速插入标题/引用/列表/分隔线
- **`@` 角色引用**：输入 `@` 列出书中角色，插入角色名（可用于后期的角色一致性分析）

**改动范围**：
- `src/components/editor/BubbleMenu.vue` — 新增 AI 功能按钮
- 新增 `src/components/ai/SceneDescDialog.vue`
- 编辑器插件层面修改 `/` 和 `@` 的输入处理

---

## v1.6 — 模板与体验打磨（预计 2-3 天）

### 📋 书籍类型模板

针对不同网文类型预置 AI 生成参数，让新书创建更精准。

| 类型 | 特色字段 | AI 提示词侧重 |
|---|---|---|
| 玄幻修仙 | 境界体系、法宝、宗门 | 力量体系、修炼路径 |
| 都市言情 | 人物关系、职场背景 | 情感发展、日常互动 |
| 悬疑推理 | 案件线索、时间线 | 逻辑链条、伏笔铺设 |
| 科幻未来 | 科技设定、世界观 | 硬核科技、社会架构 |

- 创建书籍时选择类型 → 自动填充对应 System Prompt
- `GenerateBookInfo` 根据类型生成不同的 JSON 结构

### 🔍 搜索增强

- **搜索结果上下文预览**：关键字前后各显示 50 字
- **搜索高亮**：在当前章节中高亮所有匹配项
- **搜索替换**：全局搜索并替换（需 Rust 端新增命令）

### 🎨 精致化打磨

- **字数统计智能区分**：中文按"字"计数，英文按"word"计数
- **保存状态指示器**：编辑器头部显示"已保存 ✓" / "未保存 ●" / "自动保存中 ⟳"
- **自动保存确认**：应用关闭前如有未保存内容，弹出确认提示

---

## v2.0 展望 — 长期规划

以下功能需要更多设计和技术评估，列入远期考虑：

### 架构进化
- **SQLite 替换 JSON 全量存储**：解决大书（50 万+ 字、数百章节）的性能问题
- **快照独立存储**：将 `Chapter.snapshots` 从书籍 JSON 中分离，减少每次自动保存的负载
- **插件系统**：允许社区开发扩展（如新的导出格式、AI 提供商适配器）

### 新功能
- **📖 写作日历**：日历视图展示每日写作量、连续写作天数
- **🍅 内置番茄钟**：25 分钟专注计时 + 字数统计联动
- **🌐 更多语言**：ja-JP（日文）、zh-TW（繁体中文）
- **📒 写作笔记**：每个书籍独立的灵感/设定/伏笔笔记
- **🔤 术语表**：管理自创词汇（人名、地名、专有名词），统一拼写
- **✏️ 批注/评论**：高亮文本并添加批注（类似 Google Docs）
- **🤝 协作导出**：导出可分享的 HTML 预览或评审版本

---

## 版本路线图总览

```
v1.1 ──── v1.2 ──── v1.3 ──── v1.4 ──── v1.5 ──── v1.6 ──── v2.0
  │          │         │         │         │         │         │
  │      写作目标   趋势图    EPUB导出   编辑器      类型模板   SQLite
  │      章节状态   快照Diff  角色对话   AI增强     搜索增强   插件系统
  │                              │         快捷操作              日历
  │                           Rust 改动                        番茄钟
```

每轮迭代**向后兼容**，不破坏现有数据格式，升级过程无缝。

---

欢迎参与讨论路线图的优先级排序！如果你有想要优先实现的功能，或者有其他建议，请提 Issue 或直接提交 PR。
