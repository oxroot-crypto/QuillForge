import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { spellCheckText } from '@/commands/spell'
import type { SpellError } from '@/commands/spell'

const pluginKey = new PluginKey('spellCheck')
let editorView: any = null

/**
 * TipTap extension that underlines misspelled words with a red wavy line.
 * Runs spell check on every document update (debounced 600ms).
 */
export const SpellCheck = Extension.create({
  name: 'spellCheck',

  onCreate() {
    editorView = this.editor.view
  },

  onDestroy() {
    editorView = null
  },

  addProseMirrorPlugins() {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let decorationSet = DecorationSet.empty

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init() {
            return DecorationSet.empty
          },
          apply(tr, oldState) {
            // If we have new spell check decorations in meta, use them
            const meta = tr.getMeta(pluginKey)
            if (meta !== undefined) {
              decorationSet = meta
              return meta
            }
            // Otherwise map existing decorations through the transaction
            return oldState.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return pluginKey.getState(state) || DecorationSet.empty
          },
        },
        view() {
          return {
            update(view, prevState) {
              // Debounced spell check on document changes
              if (view.state.doc === prevState.doc) return
              if (debounceTimer) clearTimeout(debounceTimer)
              debounceTimer = setTimeout(() => {
                debounceTimer = null
                runSpellCheck(view.state)
              }, 600)
            },
            destroy() {
              if (debounceTimer) clearTimeout(debounceTimer)
            },
          }
        },
      }),
    ]

    async function runSpellCheck(state: any) {
      try {
        const text = state.doc.textContent
        if (!text.trim()) {
          applyDecorations(state, DecorationSet.empty)
          return
        }
        const errors = await spellCheckText(text)
        const decos = buildDecorations(state.doc, errors)
        applyDecorations(state, decos)
      } catch {
        // Best-effort
      }
    }

    function buildDecorations(doc: any, errors: SpellError[]): DecorationSet {
      const decos = errors.map((err) => {
        const from = findTextPos(doc, err.start)
        const to = findTextPos(doc, err.end)
        if (from === -1 || to === -1) return null
        return Decoration.inline(from, to, {
          class: 'spell-error',
          title: `${err.word} — ${err.suggestions.slice(0, 3).join(', ') || 'no suggestions'}`,
        })
      }).filter(Boolean) as Decoration[]
      return DecorationSet.create(doc, decos)
    }

    function applyDecorations(state: any, decos: DecorationSet) {
      if (!editorView) return
      const tr = state.tr
      tr.setMeta(pluginKey, decos)
      editorView.dispatch(tr)
    }
  },
})

function findTextPos(doc: any, charOffset: number): number {
  let pos = 0
  let result = -1
  doc.descendants((node: any, nodePos: number) => {
    if (result !== -1) return false
    if (node.isText) {
      const len = node.text.length
      if (pos <= charOffset && charOffset <= pos + len) {
        result = nodePos + (charOffset - pos)
        return false
      }
      pos += len
    }
  })
  return result
}
