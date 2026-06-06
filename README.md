# QuillForge

面向网文作者的 AI 辅助写作桌面应用。基于 **Tauri 2.x** + **Vue 3** 构建。

## 功能

### 写作编辑器
- TipTap 富文本编辑器，衬线字体排版，专注模式
- Ghost Text AI 续写提示（Tab 接受 · Esc 取消）
- 英文拼写检查（红色波浪线标错）
- 章节状态管理（草稿 / 修改中 / 已完成 / 冻结）
- 版本快照（自动 + 手动保存，可预览恢复）

### AI 面板
- **审阅** — 文法、节奏、人物塑造、情节逻辑
- **脑暴** — 情节创意发展方向
- **续写** — AI 续写下文，支持多种续写风格
- **改写** — 选中文本或全章改写，古风/悬疑/对话润色等多模板
- **一致性检查** — 角色设定 + 大纲偏离检测
- **生成章节** — AI 一键生成完整章节内容

### Agents CLI（v1.3.0）
自然语言驱动的全能 AI 写作搭档——建书、世界观设定、角色管理、
大纲规划、章节写作、审阅分析，一句需求自动调用工具完成。

### 多 LLM 支持
- OpenAI（GPT-4o / 4-turbo / 3.5-turbo / o3-mini）
- Anthropic（Claude Opus / Sonnet / Haiku）
- Ollama（本地模型）
- OpenAI Compatible（任意兼容 API）

### 数据管理
- 多书支持，JSON 文件本地存储
- API Key AES-256-GCM 加密
- Markdown 导出

## 快速开始

```bash
npm install          # 安装依赖
npm run tauri dev    # 启动开发环境
npm run tauri build  # 生产构建
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2.x |
| 前端 | Vue 3 + TypeScript + Vite |
| 状态管理 | Pinia |
| 编辑器 | TipTap (ProseMirror) |
| 国际化 | vue-i18n |
| 后端 | Rust (reqwest + tokio) |

## 贡献

请参阅 [CONTRIBUTE.md](./CONTRIBUTE.md) 了解编码规范和提交流程。

## License

MIT
