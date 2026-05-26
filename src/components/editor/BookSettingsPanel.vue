<template>
  <div class="settings-panel">
    <!-- World Setting -->
    <div class="field">
      <div class="field-header">
        <label>{{ $t('book.worldSetting') }}</label>
        <button class="btn-ai" :disabled="genLoading === 'world'" @click="startGen('world')">
          {{ genLoading === 'world' ? '...' : 'AI' }}
        </button>
      </div>
      <p class="field-hint">{{ $t('book.worldSettingHint') }}</p>
      <div v-if="genActive === 'world'" class="gen-row">
        <input
          v-model="genPrompt"
          class="gen-input"
          :placeholder="$t('book.genSettingPlaceholder')"
          @keydown.enter="doGenerate('world')"
        />
        <button class="btn-gen-go" :disabled="genLoading === 'world'" @click="doGenerate('world')">
          {{ $t('book.generate') }}
        </button>
      </div>
      <textarea
        :value="book.worldSetting"
        class="field-textarea"
        rows="6"
        :placeholder="$t('book.worldSettingPlaceholder')"
        @input="emit('update', { worldSetting: ($event.target as HTMLTextAreaElement).value })"
      />
    </div>

    <!-- Plot Summary -->
    <div class="field">
      <div class="field-header">
        <label>{{ $t('book.storySetting') }}</label>
        <button
          class="btn-ai"
          :disabled="genLoading === 'plot' || props.book.chapters.length === 0"
          @click="doPlotSummary"
        >
          {{ genLoading === 'plot' ? `${genProgress.current}/${genProgress.total}` : 'AI' }}
        </button>
      </div>
      <p class="field-hint">{{ $t('book.storySettingHint') }}</p>
      <div v-if="genLoading === 'plot'" class="gen-progress">
        <div class="gen-progress-bar">
          <div class="gen-progress-fill" :style="{ width: genProgressPct + '%' }" />
        </div>
        <span class="gen-progress-label">{{ $t('book.genPlotProgress', { title: genProgress.chapterTitle }) }}</span>
      </div>
      <textarea
        :value="book.storySetting"
        class="field-textarea"
        rows="8"
        :placeholder="$t('book.storySettingPlaceholder')"
        @input="emit('update', { storySetting: ($event.target as HTMLTextAreaElement).value })"
      />
    </div>

    <ModalDialog
      :visible="modal.visible"
      type="alert"
      :message="modal.message"
      :ok-text="t('common.confirm')"
      @confirm="modal.visible = false"
      @update:visible="(v: boolean) => modal.visible = v"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { sendAiMessage } from '@/commands/ai'
import ModalDialog from '@/components/common/ModalDialog.vue'
import type { Book } from '@/types'

const props = defineProps<{ book: Book }>()
const emit = defineEmits<{ update: [data: Record<string, string>] }>()

const { t } = useI18n()
const settingsStore = useSettingsStore()
const genActive = ref<string>('')
const genLoading = ref<string>('')
const genPrompt = ref('')
const genProgress = reactive({ current: 0, total: 0, chapterTitle: '' })
const modal = reactive({ visible: false, message: '' })

const genProgressPct = computed(() =>
  genProgress.total > 0 ? Math.round((genProgress.current / genProgress.total) * 100) : 0,
)

function startGen(field: string) {
  genActive.value = genActive.value === field ? '' : field
  genPrompt.value = ''
}

async function doPlotSummary() {
  const chapters = props.book.chapters
  if (chapters.length === 0) return

  genLoading.value = 'plot'
  genProgress.total = chapters.length
  genProgress.current = 0

  const summaries: string[] = []
  try {
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i]
      genProgress.current = i + 1
      genProgress.chapterTitle = ch.title

      const plainText = ch.content.replace(/<[^>]*>/g, '').trim()
      if (!plainText) {
        summaries.push(`${i + 1}. ${ch.title}：(${t('book.emptyChapter')})`)
        continue
      }

      const prevContext = summaries.length > 0 ? summaries.join('\n') : ''
      const result = await sendAiMessage(settingsStore.modelConfig, {
        action: 'gen_plot_summary',
        content: plainText.slice(0, 3000),
        context: prevContext || undefined,
      })

      const numbered = result.trim().match(/^\d+\./)
        ? result.trim()
        : `${i + 1}. ${ch.title}：${result.trim()}`
      summaries.push(numbered)
    }

    // 第二步：把逐章总结凝练成一段总的故事总结
    genProgress.chapterTitle = t('book.genFinalSummary')
    const perChapterText = summaries.join('\n\n')
    const worldCtx = props.book.worldSetting ? `世界观设定：${props.book.worldSetting}\n\n` : ''
    const finalSummary = await sendAiMessage(settingsStore.modelConfig, {
      action: 'gen_plot_summary',
      content: `请将以下逐章剧情总结，整合概括成一段连贯、流畅的总故事总结（300字以内），清晰呈现整本书的情节主线、关键转折和人物弧光：\n\n${perChapterText}`,
      context: worldCtx || undefined,
    })

    emit('update', { storySetting: finalSummary.trim() })
  } catch (e: unknown) {
    modal.message = t('book.genPlotFailed') + String(e)
    modal.visible = true
  } finally {
    genLoading.value = ''
  }
}

async function doGenerate(field: string) {
  genLoading.value = field
  try {
    const existing =
      field === 'world' ? props.book.storySetting : props.book.worldSetting
    const prompt = genPrompt.value.trim() || existing || props.book.title
    const result = await sendAiMessage(settingsStore.modelConfig, {
      action: 'gen_setting',
      content: prompt,
      context: existing || undefined,
    })
    const key = field === 'world' ? 'worldSetting' : 'storySetting'
    emit('update', { [key]: result })
    genActive.value = ''
    genPrompt.value = ''
  } catch (e: unknown) {
    modal.message = `AI generation failed: ${String(e)}`
    modal.visible = true
  } finally {
    genLoading.value = ''
  }
}
</script>

<style scoped>
.settings-panel {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}

.field {
  margin-bottom: 12px;
}

.field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 1px;
}

.field-header label {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-ai {
  padding: 2px 8px;
  border: 1px solid var(--color-accent);
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  transition: all var(--transition-fast);
}
.btn-ai:hover:not(:disabled) { background: var(--color-accent); color: #fff; }
.btn-ai:disabled { opacity: 0.5; cursor: not-allowed; }

.gen-row {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

.gen-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.74rem;
  outline: none;
}

.btn-gen-go {
  padding: 4px 10px;
  border: none;
  background: var(--color-accent);
  color: #fff;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.74rem;
  font-weight: 600;
  white-space: nowrap;
}
.btn-gen-go:disabled { opacity: 0.5; cursor: not-allowed; }

.field-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  margin: 0 0 6px;
  line-height: 1.45;
}

.field-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.78rem;
  line-height: 1.55;
  resize: vertical;
  outline: none;
  font-family: inherit;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.field-textarea:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}
.field-textarea::placeholder {
  color: var(--color-text-muted);
  opacity: 0.5;
}

.gen-progress {
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gen-progress-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--color-border);
  overflow: hidden;
}

.gen-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-hover));
  border-radius: 2px;
  transition: width 0.3s ease;
}

.gen-progress-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}
</style>
