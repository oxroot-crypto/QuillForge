// 提示词模板 Store——内置 + 自定义模板的 CRUD、按功能/标签筛选、JSON 导入/导出。
// 自定义模板持久化到 localStorage，内置模板硬编码只读。
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PromptTemplate } from '@/types'

function pid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

const STORAGE_KEY = 'quillforge-templates'

function loadCustomTemplates(): PromptTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function saveCustomTemplates(templates: PromptTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

const BUILT_IN_TEMPLATES: PromptTemplate[] = [
  // ── zh-CN ──
  {
    id: 'builtin-review',
    name: '通用审阅',
    description: '从文法、节奏、人物塑造、情节逻辑等方面进行全面审阅',
    action: 'review',
    systemPrompt: '',
    tags: ['审阅', '通用'],
    locale: 'zh-CN',
    builtIn: true,
  },
  {
    id: 'builtin-idea',
    name: '情节脑暴',
    description: '根据当前情节节点给出多个创意发展方向',
    action: 'idea',
    systemPrompt: '',
    tags: ['构思', '创意'],
    locale: 'zh-CN',
    builtIn: true,
  },
  {
    id: 'builtin-continue',
    name: '自然续写',
    description: '保持文风一致地续写下文',
    action: 'continue',
    systemPrompt: '',
    tags: ['续写', '流畅'],
    locale: 'zh-CN',
    builtIn: true,
  },
  {
    id: 'builtin-consistency',
    name: '角色一致性',
    description: '检查选中段落与角色档案的一致性',
    action: 'consistency',
    systemPrompt: '',
    tags: ['检查', '角色'],
    locale: 'zh-CN',
    builtIn: true,
  },
  {
    id: 'builtin-gufeng',
    name: '古风改写',
    description: '将普通段落改写成古风风格',
    action: 'rewrite',
    systemPrompt: '请用古风风格改写。使用文言词汇和句式，适当加入典故，保持意境优美。',
    tags: ['改写', '古风'],
    locale: 'zh-CN',
    builtIn: true,
  },
  {
    id: 'builtin-xuanyi',
    name: '悬疑氛围增强',
    description: '增强场景的悬疑感和紧张气氛',
    action: 'rewrite',
    systemPrompt: '请增强悬疑氛围。使用短句制造紧张感，增加环境细节描写，暗示潜在危险，控制信息释放节奏。',
    tags: ['改写', '悬疑'],
    locale: 'zh-CN',
    builtIn: true,
  },
  {
    id: 'builtin-duihua',
    name: '对话润色',
    description: '优化对话使其更自然、符合角色性格',
    action: 'rewrite',
    systemPrompt: '请优化对话使其更自然流畅，符合角色性格和身份。每段对话应能体现说话者的个性、身份和情绪。',
    tags: ['润色', '对话'],
    locale: 'zh-CN',
    builtIn: true,
  },
  {
    id: 'builtin-jiezou',
    name: '节奏压缩',
    description: '压缩拖沓段落，加快叙事节奏',
    action: 'rewrite',
    systemPrompt: '请压缩冗余描写和重复叙述，加快叙事节奏。保留核心情节和关键细节，删除不必要的修饰。',
    tags: ['改写', '节奏'],
    locale: 'zh-CN',
    builtIn: true,
  },
  {
    id: 'builtin-zhaiyao',
    name: '章节摘要',
    description: '为章节生成简洁的剧情摘要',
    action: 'review',
    systemPrompt: '请为以下内容生成1-2句话的简洁剧情摘要，概括发生的关键事件。只输出摘要本身。',
    tags: ['摘要', '分析'],
    locale: 'zh-CN',
    builtIn: true,
  },
  // ── en-US ──
  {
    id: 'builtin-review-en',
    name: 'General Review',
    description: 'Comprehensive review of grammar, pacing, characterization, and plot logic',
    action: 'review',
    systemPrompt: '',
    tags: ['review', 'general'],
    locale: 'en-US',
    builtIn: true,
  },
  {
    id: 'builtin-idea-en',
    name: 'Plot Brainstorming',
    description: 'Generate creative plot directions based on current story nodes',
    action: 'idea',
    systemPrompt: '',
    tags: ['brainstorm', 'creative'],
    locale: 'en-US',
    builtIn: true,
  },
  {
    id: 'builtin-continue-en',
    name: 'Natural Continuation',
    description: 'Continue writing while maintaining consistent style and tone',
    action: 'continue',
    systemPrompt: '',
    tags: ['continue', 'smooth'],
    locale: 'en-US',
    builtIn: true,
  },
  {
    id: 'builtin-consistency-en',
    name: 'Character Consistency',
    description: 'Check selected text against character profiles for contradictions',
    action: 'consistency',
    systemPrompt: '',
    tags: ['check', 'character'],
    locale: 'en-US',
    builtIn: true,
  },
  {
    id: 'builtin-rewrite-classical-en',
    name: 'Classical Prose Style',
    description: 'Rewrite in a classical literary style with elegant vocabulary',
    action: 'rewrite',
    systemPrompt: 'Rewrite in a classical literary style. Use elegant vocabulary and rhythmic sentence structures. Maintain the original meaning while elevating the prose.',
    tags: ['rewrite', 'classical'],
    locale: 'en-US',
    builtIn: true,
  },
  {
    id: 'builtin-rewrite-suspense-en',
    name: 'Suspense & Tension',
    description: 'Heighten suspense and tension with pacing and atmospheric details',
    action: 'rewrite',
    systemPrompt: 'Heighten suspense and tension. Use shorter sentences to build urgency, add environmental details that hint at danger, and carefully control the release of information.',
    tags: ['rewrite', 'suspense'],
    locale: 'en-US',
    builtIn: true,
  },
  {
    id: 'builtin-rewrite-dialogue-en',
    name: 'Dialogue Polish',
    description: 'Make dialogue more natural and character-appropriate',
    action: 'rewrite',
    systemPrompt: 'Polish the dialogue to sound more natural and character-appropriate. Each line of dialogue should reflect the speaker\'s personality, background, and current emotional state.',
    tags: ['rewrite', 'dialogue'],
    locale: 'en-US',
    builtIn: true,
  },
  {
    id: 'builtin-rewrite-compress-en',
    name: 'Tighten Pacing',
    description: 'Compress verbose passages to accelerate narrative pace',
    action: 'rewrite',
    systemPrompt: 'Compress redundant descriptions and repetitive narration to accelerate the pace. Preserve core plot points and key details while removing unnecessary embellishment.',
    tags: ['rewrite', 'pacing'],
    locale: 'en-US',
    builtIn: true,
  },
  {
    id: 'builtin-atmosphere-en',
    name: 'Atmosphere Enhancement',
    description: 'Enhance scene atmosphere with richer sensory details',
    action: 'rewrite',
    systemPrompt: 'Enhance the passage with richer sensory details — sight, sound, smell, touch. Maintain the original tone and POV.',
    tags: ['rewrite', 'atmosphere'],
    locale: 'en-US',
    builtIn: true,
  },
  {
    id: 'builtin-summary-en',
    name: 'Chapter Summary',
    description: 'Generate a concise plot summary of the chapter',
    action: 'rewrite',
    systemPrompt: 'Generate a 1-2 sentence concise summary of the chapter\'s key events. Output only the summary itself.',
    tags: ['summary', 'chapter'],
    locale: 'en-US',
    builtIn: true,
  },
]

export const useTemplateStore = defineStore('templates', () => {
  // ===== 核心状态 =====
  const customTemplates = ref<PromptTemplate[]>(loadCustomTemplates())
  const activeTemplateId = ref<string>('')

  // ===== 计算属性 =====
  /** 所有模板——内置 + 自定义，内置模板在前 */
  const allTemplates = computed(() => [...BUILT_IN_TEMPLATES, ...customTemplates.value])

  /** 当前选中的模板对象 */
  const activeTemplate = computed(() =>
    allTemplates.value.find((t) => t.id === activeTemplateId.value),
  )

  // ===== 模板查询 =====
  /** 按 action 和语言筛选可用模板——内置模板仅显示当前语言，自定义模板全部显示 */
  function getTemplatesByAction(action: string, locale: string): PromptTemplate[] {
    return allTemplates.value.filter(
      (t) => t.action === action && (t.builtIn ? t.locale === locale : (t.locale === locale || t.locale === 'zh-CN')),
    )
  }

  /** 选中指定模板 */
  function selectTemplate(id: string) {
    activeTemplateId.value = id
  }

  // ===== 自定义模板 CRUD =====
  /** 添加自定义模板——生成唯一 ID，标记为非内置 */
  function addCustomTemplate(tpl: Omit<PromptTemplate, 'id' | 'builtIn'>): PromptTemplate {
    const template: PromptTemplate = {
      ...tpl,
      id: pid(),
      builtIn: false,
    }
    customTemplates.value.push(template)
    persist()
    return template
  }

  /** 删除自定义模板 */
  function removeCustomTemplate(id: string) {
    const idx = customTemplates.value.findIndex((t) => t.id === id)
    if (idx !== -1) {
      customTemplates.value.splice(idx, 1)
      persist()
    }
  }

  /** 更新自定义模板的指定字段 */
  function updateCustomTemplate(id: string, data: Partial<PromptTemplate>) {
    const tpl = customTemplates.value.find((t) => t.id === id)
    if (tpl) {
      Object.assign(tpl, data)
      persist()
    }
  }

  /** 从 JSON 字符串导入模板——返回成功导入的数量 */
  function importTemplates(json: string): number {
    try {
      const items = JSON.parse(json)
      const arr = Array.isArray(items) ? items : [items]
      let count = 0
      for (const item of arr) {
        if (item.name && item.systemPrompt) {
          addCustomTemplate({
            name: item.name,
            description: item.description || '',
            action: item.action || 'review',
            systemPrompt: item.systemPrompt,
            userPrompt: item.userPrompt,
            tags: item.tags || [],
            locale: item.locale || 'zh-CN',
          })
          count++
        }
      }
      return count
    } catch {
      return 0
    }
  }

  /** 导出所有自定义模板为 JSON 字符串 */
  function exportTemplates(): string {
    return JSON.stringify(customTemplates.value, null, 2)
  }

  // ===== 持久化 =====
  /** 将自定义模板列表写入 localStorage */
  function persist() {
    saveCustomTemplates(customTemplates.value)
  }

  // ===== 导出 =====
  return {
    // 状态
    customTemplates,
    activeTemplateId,
    // 计算属性
    allTemplates,
    activeTemplate,
    // 查询
    getTemplatesByAction,
    selectTemplate,
    // 自定义模板 CRUD
    addCustomTemplate,
    removeCustomTemplate,
    updateCustomTemplate,
    // 导入导出
    importTemplates,
    exportTemplates,
  }
})
