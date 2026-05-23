import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

const ghostKey = new PluginKey('ghostText')

let _ghost: { text: string; from: number } | null = null
let _editorView: any = null

function setGhostRaw(text: string | null) {
  if (!_editorView) return
  if (text === null) {
    const tr = _editorView.state.tr.setMeta(ghostKey, { text: null })
    _editorView.dispatch(tr)
    _ghost = null
    return
  }
  const { from } = _editorView.state.selection
  // Full text for Tab insertion; display text includes hint
  const hint = '  ↵ Tab'
  const displayText = text.length > 60 ? text.slice(0, 60) + '…' + hint : text + hint
  const tr = _editorView.state.tr.setMeta(ghostKey, { text, from, displayText })
  _editorView.dispatch(tr)
}

export function showGhostText(text: string) {
  setGhostRaw(text)
}

export function clearGhostText() {
  setGhostRaw(null)
}

export function setEditorView(editor: any) {
  _editorView = editor.view
}

export const GhostText = Extension.create({
  name: 'ghostText',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: ghostKey,
        state: {
          init() { return DecorationSet.empty },
          apply(tr, set) {
            const meta = tr.getMeta(ghostKey)
            if (meta === undefined) return set
            if (meta === null || meta.text === null) return DecorationSet.empty

            _ghost = { text: meta.text, from: meta.from }
            const displayText = meta.displayText || meta.text
            const deco = Decoration.widget(meta.from, () => {
              const span = document.createElement('span')
              span.className = 'ghost-text-decoration'
              span.textContent = displayText
              span.style.cssText = 'color:var(--color-text-muted);opacity:0.35;pointer-events:none;user-select:none;white-space:pre-wrap;'
              return span
            }, { side: 1 })
            return DecorationSet.create(tr.doc, [deco])
          },
        },
        props: {
          decorations(state) { return this.getState(state) },
          handleKeyDown(view, event) {
            if (!_ghost) return false
            if (event.key === 'Tab') {
              event.preventDefault()
              const tr = view.state.tr
              tr.insertText(_ghost.text, _ghost.from)
              tr.setMeta(ghostKey, { text: null })
              view.dispatch(tr)
              _ghost = null
              return true
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              view.dispatch(view.state.tr.setMeta(ghostKey, { text: null }))
              _ghost = null
              return true
            }
            if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Enter') {
              view.dispatch(view.state.tr.setMeta(ghostKey, { text: null }))
              _ghost = null
              return false
            }
            return false
          },
        },
      }),
    ]
  },
})
