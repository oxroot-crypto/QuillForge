import { invoke } from '@tauri-apps/api/core'
import type { ModelConfig } from '@/types'
import type { AgentTool, AgentContext } from './types'

const MAX_ITERATIONS = 15

/**
 * Parse tool call from AI response.
 *
 * Two formats:
 * 1) Single-line: TOOL: tool_name | arg1=val1 | arg2=val2
 * 2) Multi-line content: TOOL: tool_name | arg1=val1 | content
 *    (full chapter text here, supports any length)
 */
function parseToolCall(text: string): { name: string; args: Record<string, any> } | null {
  const trimmed = text.trimStart()

  const toolPrefix = /^TOOL:\s*(\w+)\s*(?:\|(.*))?$/im
  const match = trimmed.match(toolPrefix)
  if (!match) return null

  const name = match[1].toLowerCase()
  const argText = match[2]?.trim() || ''
  const args: Record<string, any> = {}

  // Check if multi-line content mode: last token is bare "content"
  const tokens = argText.split('|').map(s => s.trim())
  const hasBareContent = tokens.some(t => t === 'content' && !t.includes('='))

  if (hasBareContent) {
    // Parse params (everything before the bare "content" token)
    for (const token of tokens) {
      if (token === 'content') break
      const eqIdx = token.indexOf('=')
      if (eqIdx > 0) {
        args[token.slice(0, eqIdx).trim()] = token.slice(eqIdx + 1).trim()
      }
    }
    // Everything after first line is the content — but truncate at AI commentary
    const firstNewline = trimmed.indexOf('\n')
    if (firstNewline > 0) {
      let raw = trimmed.slice(firstNewline + 1).trim()
      // Remove leading tool call if AI put it in content
      raw = raw.replace(/^TOOL:.*$/m, '').trim()
      // Truncate at FIRST occurrence of FINAL: or TOOL: on a new line (AI adds these as commentary)
      const finIdx = raw.search(/\nFINAL:/)
      const toolIdx = raw.search(/\nTOOL:/)
      const cutoff = finIdx >= 0 && toolIdx >= 0 ? Math.min(finIdx, toolIdx)
        : finIdx >= 0 ? finIdx
        : toolIdx >= 0 ? toolIdx
        : -1
      if (cutoff >= 0) raw = raw.slice(0, cutoff).trim()
      args.content = raw
    } else {
      args.content = ''
    }
  } else {
    // Standard pipe-delimited single-line params
    for (const token of tokens) {
      const eqIdx = token.indexOf('=')
      if (eqIdx > 0) {
        const key = token.slice(0, eqIdx).trim()
        let val = token.slice(eqIdx + 1).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        args[key] = val
      }
    }
  }

  return { name, args }
}

function buildSystemPrompt(tools: AgentTool[], ctx: AgentContext): string {
  const toolDesc = tools.map((t) => {
    const params = Object.entries(t.parameters)
      .map(([name, p]) => {
        const req = p.required ? '(必填)' : '(可选)'
        const enumStr = p.enum ? ` [${p.enum.join('|')}]` : ''
        return `  ${name}${req}: ${p.type}${enumStr} — ${p.description}`
      })
      .join('\n')
    return `${t.name}: ${t.description}\n  参数:\n${params || '  无参数'}`
  }).join('\n\n')

  return `你是一个运行在 QuillForge 写作软件中的 AI Agent。你可以调用工具来帮助用户创作网文。

========== 响应格式（必须严格遵守） ==========

每次回复必须以以下两种格式之一开头：

格式1 — 调用工具：
TOOL: 工具名 | 参数1=值1 | 参数2=值2
（然后可以写解释文字）

格式2 — 最终回答：
FINAL: 你的回答内容

========== 多行正文格式 ==========
当需要写入大量正文（如 edit_chapter）时，使用多行格式：
TOOL: edit_chapter | chapter=章节名 | content
（纯粹的小说正文，不要加任何解释、不要加 "FINAL:"、不要加说明文字）
注意：| content 之后只能放小说正文。不要写你的分析、不要写后续计划、不要写 FINAL、不要写任何注释。写进去的全都会变成小说内容的一部分。

========== 规则 ==========
1. 需要查看内容时，先调用 read_chapter 或 read_book_info
2. edit_chapter 的 content 用纯文本，不要 HTML
3. 不知道角色ID时，先 read_book_info 查看
4. 重要：写章节时，必须一次性把全部正文传入 edit_chapter 的 content。不要分多次 append，不要在回复里假装写了但实际没调工具。一次 edit_chapter 就要包含完整章节内容。
5. 书籍完整上下文（世界观、剧情总结、角色档案、大纲）已经自动提供给你了，不要反复调用 read_book_info 去读，直接用这些信息创作。只有需要查看章节正文时才调用 read_chapter。
6. edit_chapter、append_chapter 等工具都支持 chapter 参数，传章节标题即可操作，无需选中。
7. 不要重复创建同名章节。create_chapter 成功后如果收到"未调用写入工具"的错误，说明需要 edit_chapter 写入内容，不是再创建一次。
8. **创建章节 ≠ 写入内容**：create_chapter 只创建空章节，不会写入任何正文。你必须再调用 edit_chapter 来写入实际内容。如果你只调用了 create_chapter 就说"已完成"或"已写出"，会被拦截。
9. **快照自动保存**：edit_chapter 和 append_chapter 在修改非空章节时会自动保存快照备份，你不需要手动调用 save_snapshot。

========== 书籍上下文 ==========
书名: ${ctx.bookTitle || '无'} | 章节: ${ctx.chapterCount}章 / ${ctx.wordCount}字 | 角色: ${ctx.charCount}个
${ctx.worldSetting ? `\n【世界观】${ctx.worldSetting.slice(0, 800)}${ctx.worldSetting.length > 800 ? '...' : ''}` : ''}
${ctx.storySetting ? `\n【剧情总结】${ctx.storySetting.slice(0, 500)}${ctx.storySetting.length > 500 ? '...' : ''}` : ''}
${ctx.characters.length > 0 ? `\n【角色】\n${ctx.characters.slice(0, 15).map(c => {
  const roleLabel = c.role === 'protagonist' ? '主' : c.role === 'antagonist' ? '反' : c.role === 'supporting' ? '配' : '路'
  const desc = (c.description || '').slice(0, 80)
  return `  [${roleLabel}]${c.name}${desc ? ': ' + desc : ''}`
}).join('\n')}${ctx.characters.length > 15 ? `\n  ...及其他${ctx.characters.length - 15}位角色` : ''}` : ''}
${ctx.outline ? `\n【大纲】${ctx.outline.slice(0, 800)}${ctx.outline.length > 800 ? '...' : ''}` : ''}

========== 可用工具 ==========

${toolDesc}

========== 示例 ==========

用户：帮我创建一个反派角色
TOOL: read_book_info
[等待工具结果...]
TOOL: add_character | name=血影魔尊 | role=antagonist | description=千年前被封印的魔界至尊，如今破封而出，誓要统治三界。
FINAL: 已创建反派角色「血影魔尊」！

用户：帮我写第一章，2000字
TOOL: create_chapter | title=第一章 初入异界
[等待工具结果...]
TOOL: edit_chapter | chapter=第一章 初入异界 | content
林风睁开眼时，映入眼帘的是一片陌生的星空。他记得自己正在调试量子计算机，然后一道蓝光闪过，意识便陷入了黑暗。醒来时，他发现自己躺在一片柔软的草地上，空气中弥漫着草木的清香...
（整章完整内容，2000字一次写入，不需要分段。快照会自动保存）
FINAL: 已完成第一章「初入异界」，共约2000字。

========== 记住 ==========
- 第一行必须是 TOOL: 或 FINAL:，没有例外。
- 写章节的顺序：先 create_chapter，再 edit_chapter。不要反着来。
- edit_chapter 的 chapter 参数指定的章节标题必须已存在于书籍中。
- edit_chapter 和 append_chapter 会自动保存快照，无需手动调用 save_snapshot。`
}

export async function runAgent(
  userMessage: string,
  tools: AgentTool[],
  ctx: AgentContext,
  config: ModelConfig,
  onMessage: (msg: any) => void,
  onToolCall: (tc: { name: string; args: Record<string, any> }) => void,
  onToolResult: (result: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  isCancelled?: () => boolean,
): Promise<void> {
  const systemPrompt = buildSystemPrompt(tools, ctx)

  // conversation: array of { role, content }
  const conv: { role: 'user' | 'assistant' | 'tool'; content: string }[] = [
    { role: 'user', content: userMessage },
  ]

  // Use 'agent' action — Rust backend has no matching case,
  // so it falls through to the default arm which passes content as-is.
  // Also pass our system prompt via config so Rust uses it directly.
  const agentConfig: ModelConfig = {
    ...config,
    system_prompt: systemPrompt,
  }

  const READ_ONLY_TOOLS = new Set(['read_chapter', 'read_chapters_list', 'read_book_info', 'read_selection', 'read_stats'])

  // Tools that actually modify content (not just preparatory ones like save_snapshot)
  const CONTENT_WRITE_TOOLS = new Set(['edit_chapter', 'append_chapter'])

  let iterations = 0
  // Track whether ANY modification tool succeeded (incl. save_snapshot etc.)
  let anyToolSucceeded = false
  // Track whether a content-writing tool (edit_chapter/append_chapter/create_chapter) succeeded
  let contentWritten = false
  // Track whether a chapter was created but never written to
  let chapterCreatedWithoutWrite = false
  let lastCreatedChapterTitle = ''
  // Track actual word count from last write operation
  let actualWrittenWords = 0

  while (iterations < MAX_ITERATIONS) {
    iterations++
    if (isCancelled?.()) {
      onDone()
      return
    }

    try {
      // Keep conversation lean: keep user msg + last 6 entries to save tokens
      const slimConv = [conv[0], ...conv.slice(-6)]
      // Build conversation text: just user/assistant/tool messages
      const conversationText = slimConv.map((m) => {
        switch (m.role) {
          case 'user': return `[用户]\n${m.content}`
          case 'assistant': return `[助手]\n${m.content}`
          case 'tool': return `[工具结果]\n${m.content}`
        }
      }).join('\n\n---\n\n')

      const result = await invoke<string>('send_ai_message', {
        config: agentConfig,
        request: { action: 'agent', content: conversationText },
      })

      const cleaned = result.trim()
      if (!cleaned) {
        conv.push({ role: 'assistant', content: '(空响应)' })
        continue
      }

      // Parse tool call
      const parsed = parseToolCall(cleaned)

      if (parsed) {
        const tool = tools.find((t) => t.name === parsed.name)
        if (!tool) {
          conv.push({ role: 'assistant', content: cleaned })
          conv.push({ role: 'tool', content: `错误：没有「${parsed.name}」这个工具。可用工具：${tools.map(t => t.name).join(', ')}` })
          onToolCall({ name: parsed.name, args: parsed.args })
          onToolResult(`❌ 未知工具「${parsed.name}」`)
          continue
        }

        onToolCall({ name: parsed.name, args: parsed.args })
        conv.push({ role: 'assistant', content: cleaned })

        // Yield to let Vue flush the "running" UI state before tool executes
        await new Promise(r => setTimeout(r, 16))

        try {
          const toolResult = await tool.execute(parsed.args)
          conv.push({ role: 'tool', content: toolResult })
          onToolResult(toolResult)

          // Only mark tool as successful if it returned without error
          const isError = toolResult.startsWith('错误：') || toolResult.startsWith('❌')
          if (!isError) {
            // Track ANY non-read-only tool success
            if (!READ_ONLY_TOOLS.has(parsed.name)) {
              anyToolSucceeded = true
            }
            // Track content-writing tools separately (edit_chapter / append_chapter)
            if (CONTENT_WRITE_TOOLS.has(parsed.name)) {
              contentWritten = true
              chapterCreatedWithoutWrite = false
            }
            if (parsed.name === 'edit_chapter' || parsed.name === 'append_chapter') {
              const wcMatch = toolResult.match(/新字数:\s*(\d+)/)
              if (wcMatch) actualWrittenWords = parseInt(wcMatch[1], 10)
            }
            if (parsed.name === 'create_chapter' && !parsed.args?.content) {
              chapterCreatedWithoutWrite = true
              lastCreatedChapterTitle = String(parsed.args?.title || '')
            }
            // create_chapter with content is not reliable — AI may pass garbage.
            // Only edit_chapter/append_chapter count as real content writing.
          }
        } catch (e: any) {
          const errMsg = `执行错误: ${e?.message || e}`
          conv.push({ role: 'tool', content: errMsg })
          onToolResult(`❌ ${errMsg}`)
        }
      } else {
        // Check for FINAL: prefix
        const trimmed = cleaned.trimStart()
        if (trimmed.toUpperCase().startsWith('FINAL:')) {
          const finalContent = trimmed.slice(6).trim()

          // Validate: if FINAL claims completion but no actual tool was called
          const claimPattern = /已完成|已创建|已保存|已更新|已删除|已写入|已翻译|已修改|已添加|已替换|已生成|已设置|已重命名/i
          if (claimPattern.test(finalContent) && !anyToolSucceeded) {
            // General claim without any tool called at all
            const hint = '你声称已完成操作，但并未实际调用任何工具。必须实际调用工具来执行操作！'
            conv.push({ role: 'assistant', content: cleaned })
            conv.push({ role: 'tool', content: `错误：${hint}` })
            onToolResult(`❌ 校验失败：声称「${finalContent.slice(0, 30)}」但未调用任何工具，已要求重试`)
            continue
          }
          // If a chapter was created but never written to, any FINAL mentioning
          // content/completion/字数 is a lie — AI must call edit_chapter first.
          if (chapterCreatedWithoutWrite && /字|内容|第[^创]/.test(finalContent)) {
            const chName = lastCreatedChapterTitle || '章节名'
            const hint = `你创建了「${chName}」但没有写入任何内容。不要再创建新章节了！直接用 edit_chapter 写入完整正文。`
            conv.push({ role: 'assistant', content: cleaned })
            conv.push({ role: 'tool', content: `错误：${hint}\nTOOL: edit_chapter | chapter=${chName} | content\n（完整正文，不要加 FINAL 或解释）` })
            onToolResult(`❌ 校验失败：创建了「${chName}」但未调用 edit_chapter，已要求重试`)
            continue
          }
          // Content modification claim (without preceding create_chapter) requires write tools
          if (!contentWritten && /第[一二三四五六七八九十\d零〇百千万]+[章节卷]/.test(finalContent) && /完\s*成|创\s*作|已.*(?:写|翻|改|替|填|生|修)/i.test(finalContent)) {
            const hint = '你声称已修改内容，但并未调用 edit_chapter 或 append_chapter 工具。必须实际调用写入工具！'
            conv.push({ role: 'assistant', content: cleaned })
            conv.push({ role: 'tool', content: `错误：${hint}\nTOOL: edit_chapter | chapter=${lastCreatedChapterTitle || '章节名'} | content\n（完整正文，不要加 FINAL 或解释）` })
            onToolResult(`❌ 校验失败：声称「${finalContent.slice(0, 30)}」但未写入内容，已要求重试`)
            continue
          }

          onMessage({ role: 'assistant', content: finalContent || cleaned })
          onDone()
          return
        }

        // No prefix — treat as final response
        onMessage({ role: 'assistant', content: cleaned })
        onDone()
        return
      }
    } catch (e: any) {
      onError(e?.toString() || 'AI 请求失败')
      onDone()
      return
    }
  }

  onMessage({ role: 'assistant', content: `⚠️ 已达到最大迭代次数(${MAX_ITERATIONS})` })
  onDone()
}
